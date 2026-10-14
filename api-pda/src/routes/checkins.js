const express = require('express');
const { pool, transacao } = require('../db');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();
router.use(exigeLider);

// Erro com status HTTP, para sair da transação com uma mensagem clara
function falha(status, mensagem) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

// GET /checkins/painel -> lista com checkbox: todos os colaboradores ativos
// e, para quem está com PDA, qual é e desde quando
router.get('/painel', async (req, res) => {
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
  res.json(linhas.map((l) => ({ ...l, com_pda: l.checkin_id !== null })));
});

// GET /checkins/historico?de=2026-10-01&ate=2026-10-14&busca=joao
// Todos os check-ins do período (padrão: últimos 7 dias), do mais recente para o mais antigo
router.get('/historico', async (req, res) => {
  const dataValida = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
  const hoje = new Date();
  const seteDiasAtras = new Date(hoje.getTime() - 6 * 24 * 60 * 60 * 1000);
  const iso = (d) => d.toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do servidor
  const de = dataValida(req.query.de) ? req.query.de : iso(seteDiasAtras);
  const ate = dataValida(req.query.ate) ? req.query.ate : iso(hoje);
  const busca = String(req.query.busca || '').trim();

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

      const [r] = await conn.query(
        'INSERT INTO checkins (pda_id, colaborador_id, lider_checkin_id) VALUES (?, ?, ?)',
        [pda.id, colab.id, req.lider.id]
      );
      await conn.query("UPDATE pdas SET status = 'reservado' WHERE id = ?", [pda.id]);

      return { checkin_id: r.insertId, colaborador: colab.nome, pda: pda.numero_serie, situacao: 'aguardando' };
    });
    res.status(201).json(resultado);
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message });
    // Trava do banco: a pessoa já tem um check-in aberto
    if (erro.code === 'ER_DUP_ENTRY' && erro.message.includes('uq_colab_ativo')) {
      return res.status(409).json({ erro: 'Este colaborador já está com um PDA. Faça o check-out antes.' });
    }
    if (erro.code === 'ER_DUP_ENTRY' && erro.message.includes('uq_pda_ativo')) {
      return res.status(409).json({ erro: 'Este PDA já está com outra pessoa.' });
    }
    throw erro;
  }
});

// POST /checkins/:id/checkout { "observacao"?: "tela trincada" } -> desmarcar o checkbox
router.post('/:id/checkout', async (req, res) => {
  const checkinId = Number(req.params.id);
  const observacao = String(req.body?.observacao || '').trim().slice(0, 255) || null;

  try {
    const resultado = await transacao(async (conn) => {
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