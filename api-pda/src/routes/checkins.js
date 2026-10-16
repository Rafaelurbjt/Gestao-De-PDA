/**
 * routes/checkins.js
 *
 * Rotas do balcão para vincular colaborador e PDA (check-in) e desfazer o
 * vínculo (check-out). Todas exigem líder logado.
 *
 *   GET  /checkins/painel         lista de colaboradores e quem está com PDA
 *   GET  /checkins/historico      check-ins de um período (padrão: 7 dias)
 *   POST /checkins                faz o check-in (marca o checkbox)
 *   POST /checkins/:id/checkout   faz o check-out (desmarca o checkbox)
 *
 * Ciclo de um check-in:
 *   aguardando  -> líder fez o check-in; o colaborador ainda não digitou o CPF
 *   em_uso      -> colaborador confirmou o CPF no PDA
 *   finalizado  -> check-out feito depois de ter usado o PDA
 *   cancelado   -> check-out feito sem o colaborador ter chegado a usar
 *
 * Ciclo do PDA: livre -> reservado (check-in) -> em_uso (CPF confirmado) -> livre
 */

const express = require('express');
const { pool, transacao } = require('../db');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();

// Todas as rotas deste arquivo passam antes pelo middleware de login do líder
router.use(exigeLider);

// Cria um erro com status HTTP. Serve para sair da transação com uma mensagem
// clara: o catch das rotas lê o "status" e responde com ele.
function falha(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

// GET /checkins/painel -> lista com checkbox: todos os colaboradores ativos
// e, para quem está com PDA, qual é e desde quando
router.get('/painel', async (req, res) => {
  // LEFT JOIN: traz o colaborador mesmo sem check-in aberto (k e p ficam null).
  // k.colaborador_ativo só tem valor enquanto o check-in está aberto (coluna
  // gerada no banco), então o join pega apenas o check-in atual de cada pessoa.
  // ORDER BY (k.id IS NULL): quem está com PDA aparece primeiro, depois por nome.
  const [linhas] = await pool.query(
    `SELECT c.id AS colaborador_id, c.nome, c.cpf, c.vinculo, e.nome AS empresa,
            k.id AS checkin_id, k.status AS situacao, k.checkin_em,
            p.id AS pda_id, p.numero_serie AS pda, p.modelo
       FROM colaboradores c
       JOIN empresas e      ON e.id = c.empresa_id
       LEFT JOIN checkins k ON k.colaborador_ativo = c.id
       LEFT JOIN pdas p     ON p.id = k.pda_id
      WHERE c.ativo = 1
      ORDER BY (k.id IS NULL), c.nome`
  );
  // com_pda = true quando existe check-in aberto (o checkbox marcado na tela)
  res.json(linhas.map((l) => ({ ...l, com_pda: l.checkin_id !== null })));
});

// GET /checkins/historico?de=2026-10-01&ate=2026-10-14&busca=joao
// Todos os check-ins do período (padrão: últimos 7 dias), do mais recente para o mais antigo
router.get('/historico', async (req, res) => {
  // Aceita só datas no formato AAAA-MM-DD; qualquer outra coisa cai no padrão
  const dataValida = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const hoje = new Date();
  // Hoje conta como o 1º dia, então "7 dias" = 6 dias atrás até hoje
  const seteDiasAtras = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);
  const iso = (d) => d.toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do servidor
  const de = dataValida(req.query.de) ? req.query.de : iso(seteDiasAtras);
  const ate = dataValida(req.query.ate) ? req.query.ate : iso(hoje);
  const busca = String(req.query.busca || '').trim();

  // minutos_uso: do momento em que o CPF foi confirmado até o check-out.
  // Os JOINs de líder usam a mesma tabela duas vezes com apelidos diferentes
  // (li = quem fez o check-in, lo = quem fez o check-out; esse pode ser vazio).
  // A data final soma 1 dia e usa "<" para incluir o dia inteiro de "ate".
  // Busca vazia ('' = '') desliga o filtro; com texto, procura em nome ou série.
  // Os "?" mantêm os valores separados do SQL (protege contra injeção).
  const [linhas] = await pool.query(
    `SELECT k.id, k.status, k.checkin_em, k.confirmado_em, k.checkout_em,
            k.cpf_errado_qtd, k.observacao,
            TIMESTAMPDIFF(MINUTE, k.confirmado_em, k.checkout_em) AS minutos_uso,
            c.nome AS colaborador, c.cpf, c.vinculo, e.nome AS empresa,
            p.numero_serie AS pda, p.modelo,
            li.nome AS lider_checkin, lo.nome AS lider_checkout
       FROM checkins k
       JOIN colaboradores c  ON c.id = k.colaborador_id
       JOIN empresas e       ON e.id = c.empresa_id
       JOIN pdas p           ON p.id = k.pda_id
       JOIN colaboradores li ON li.id = k.lider_checkin_id
       LEFT JOIN colaboradores lo ON lo.id = k.lider_checkout_id
      WHERE k.checkin_em >= ? AND k.checkin_em < DATE_ADD(?, INTERVAL 1 DAY)
        AND (? = '' OR c.nome LIKE ? OR p.numero_serie LIKE ?)
      ORDER BY k.checkin_em DESC
      LIMIT 1000`,
    [de, ate, busca, `%${busca}%`, `%${busca}%`]
  );
  res.json({ de, ate, linhas });
});

// POST /checkins { "colaborador_id", "pda_id" } -> marcar o checkbox
router.post('/', async (req, res) => {
  const colaboradorId = Number(req.body.colaborador_id);
  const pdaId = Number(req.body.pda_id);
  if (!colaboradorId || !pdaId) {
    return res.status(400).json({ erro: 'Escolha o colaborador e o PDA.' });
  }

  try {
    // Tudo dentro da transação acontece junto ou não acontece: se qualquer
    // passo falhar, o banco desfaz os anteriores.
    const resultado = await transacao(async (conn) => {
      // FOR UPDATE "tranca" a linha do PDA até o fim da transação:
      // se dois líderes clicarem ao mesmo tempo, o segundo espera e vê o PDA já reservado
      const [[pda]] = await conn.query(
        'SELECT id, numero_serie, status FROM pdas WHERE id = ? AND ativo = 1 FOR UPDATE', [pdaId]
      );
      if (!pda) throw falha(404, 'PDA não encontrado.');
      if (pda.status !== 'livre') {
        throw falha(409, `O PDA ${pda.numero_serie} não está livre (situação: ${pda.status}).`);
      }

      const [[colab]] = await conn.query(
        'SELECT id, nome FROM colaboradores WHERE id = ? AND ativo = 1', [colaboradorId]
      );
      if (!colab) throw falha(404, 'Colaborador não encontrado.');

      // Cria o check-in (nasce como "aguardando") e reserva o PDA
      const [r] = await conn.query(
        'INSERT INTO checkins (pda_id, colaborador_id, lider_checkin_id) VALUES (?, ?, ?)',
        [pda.id, colab.id, req.lider.id]
      );
      await conn.query("UPDATE pdas SET status = 'reservado' WHERE id = ?", [pda.id]);

      return { checkin_id: r.insertId, colaborador: colab.nome, pda: pda.numero_serie, situacao: 'aguardando' };
    });
    res.status(201).json(resultado);
  } catch (erro) {
    // Erros criados por falha(): responde com o status e a mensagem escolhidos
    if (erro.status) return res.status(erro.status).json({ erro: erro.message });
    // Rede de segurança: as regras também estão no banco (índices UNIQUE).
    // Se passarem pela checagem acima, o banco recusa e traduzimos o erro.
    // Trava do banco: a pessoa já tem um check-in aberto
    if (erro.code === 'ER_DUP_ENTRY' && erro.message.includes('uq_colab_ativo')) {
      return res.status(409).json({ erro: 'Este colaborador já está com um PDA. Faça o check-out antes.' });
    }
    if (erro.code === 'ER_DUP_ENTRY' && erro.message.includes('uq_pda_ativo')) {
      return res.status(409).json({ erro: 'Este PDA já está com outra pessoa.' });
    }
    // Qualquer outro erro vai para o tratador geral do server.js (responde 500)
    throw erro;
  }
});

// POST /checkins/:id/checkout { "observacao"?: "tela trincada" } -> desmarcar o checkbox
router.post('/:id/checkout', async (req, res) => {
  const checkinId = Number(req.params.id);
  // Observação opcional, limitada a 255 caracteres; vazia vira null
  const observacao = String(req.body?.observacao || '').trim().slice(0, 255) || null;

  try {
    const resultado = await transacao(async (conn) => {
      // Só encerra check-in que ainda está aberto; FOR UPDATE evita dois
      // check-outs ao mesmo tempo no mesmo registro
      const [[k]] = await conn.query(
        `SELECT id, pda_id, status FROM checkins
          WHERE id = ? AND status IN ('aguardando','em_uso') FOR UPDATE`,
        [checkinId]
      );
      if (!k) throw falha(404, 'Check-in não encontrado ou já encerrado.');

      // Se o colaborador nem chegou a confirmar o CPF no PDA, conta como cancelado
      const novoStatus = k.status === 'em_uso' ? 'finalizado' : 'cancelado';
      await conn.query(
        `UPDATE checkins
            SET status = ?, checkout_em = NOW(), lider_checkout_id = ?, observacao = ?
          WHERE id = ?`,
        [novoStatus, req.lider.id, observacao, k.id]
      );
      // O PDA volta a ficar livre (se o líder não o bloqueou ou mandou para manutenção)
      await conn.query(
        "UPDATE pdas SET status = 'livre' WHERE id = ? AND status IN ('reservado','em_uso')",
        [k.pda_id]
      );
      return { checkin_id: k.id, situacao: novoStatus };
    });
    res.json(resultado);
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message });
    throw erro;
  }
});

module.exports = router;