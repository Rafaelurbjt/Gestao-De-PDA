/**
 * routes/pdas.js
 *
 * Cadastro e situação dos PDAs (aparelhos). Todas as rotas exigem líder logado.
 *
 *   GET   /pdas               lista os PDAs e quem está com cada um agora
 *   POST  /pdas               cadastra um PDA (número de série e modelo)
 *   PATCH /pdas/:id/status    bloqueia, manda para manutenção ou libera
 *
 * Situações possíveis (pdas.status):
 *   livre      pode receber um check-in
 *   reservado  check-in feito, esperando o colaborador digitar o CPF
 *   em_uso     CPF confirmado
 *   bloqueado / manutencao   fora de uso, só o líder tira desse estado
 *
 * O token que identifica o aparelho NÃO é criado aqui, e sim em
 * POST /dispositivo/registrar (ver dispositivo.js).
 */

const express = require('express');
const { pool, transacao } = require('../db');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();

// Todas as rotas deste arquivo passam antes pelo middleware de login do líder
router.use(exigeLider);

// GET /pdas -> todos os PDAs e quem está com cada um agora
router.get('/', async (req, res) => {
  // LEFT JOIN: traz o PDA mesmo sem ninguém usando (colaborador e checkin_em
  // ficam null). k.pda_ativo só tem valor enquanto o check-in está aberto
  // (coluna gerada no banco), então o join pega só o uso atual.
  const [lista] = await pool.query(
    `SELECT p.id, p.numero_serie, p.modelo, p.status,
            c.nome AS colaborador, k.checkin_em
       FROM pdas p
       LEFT JOIN checkins k      ON k.pda_ativo = p.id
       LEFT JOIN colaboradores c ON c.id = k.colaborador_id
      WHERE p.ativo = 1
      ORDER BY p.numero_serie`
  );
  res.json(lista);
});

// POST /pdas { "numero_serie", "modelo" }
router.post('/', async (req, res) => {
  // Série em maiúsculas e sem espaços nas pontas, para "abc1" e "ABC1" serem o mesmo
  const numeroSerie = String(req.body.numero_serie || '').trim().toUpperCase();
  const modelo = String(req.body.modelo || '').trim();
  if (!numeroSerie) return res.status(400).json({ erro: 'Informe o número de série.' });
  if (!modelo) return res.status(400).json({ erro: 'Informe o modelo.' });

  // O status não é informado: o banco já cria o PDA como "livre". Série
  // repetida é recusada pelo banco (UNIQUE) e o server.js responde 409.
  const [r] = await pool.query(
    'INSERT INTO pdas (numero_serie, modelo) VALUES (?, ?)', [numeroSerie, modelo]
  );
  res.status(201).json({ id: r.insertId, numero_serie: numeroSerie, modelo, status: 'livre' });
});

// PATCH /pdas/:id/status { "status": "bloqueado" | "manutencao" | "livre" }
// Bloquear ou mandar para manutenção encerra o uso em andamento (se houver).
// "livre" só vale para tirar do bloqueio ou da manutenção.
router.patch('/:id/status', async (req, res) => {
  const pdaId = Number(req.params.id);
  const novo = String(req.body.status || '');

  // Lista fechada: o líder não pode forçar "reservado" ou "em_uso" por aqui,
  // esses estados só mudam pelo fluxo de check-in e do PDA
  if (!['bloqueado', 'manutencao', 'livre'].includes(novo)) {
    return res.status(400).json({ erro: 'Situação inválida.' });
  }

  // Como em dispositivo.js, a transação devolve { status, corpo } em vez de
  // lançar erros, e a resposta HTTP sai depois
  const resultado = await transacao(async (conn) => {
    // FOR UPDATE tranca o PDA: ninguém faz check-in nele enquanto mudamos a situação
    const [[pda]] = await conn.query(
      'SELECT id, numero_serie, status FROM pdas WHERE id = ? AND ativo = 1 FOR UPDATE', [pdaId]
    );
    if (!pda) return { status: 404, corpo: { erro: 'PDA não encontrado.' } };

    if (novo === 'livre') {
      // Só dá para liberar quem estava bloqueado ou em manutenção. Um PDA
      // reservado ou em uso precisa de check-out, não de liberação manual.
      if (!['bloqueado', 'manutencao'].includes(pda.status)) {
        return { status: 409, corpo: { erro: `O PDA ${pda.numero_serie} não está bloqueado nem em manutenção.` } };
      }
    } else {
      // Bloquear ou mandar para manutenção: encerra o check-in aberto, se existir.
      // Se a pessoa já estava usando vira "finalizado"; se ainda esperava o
      // CPF, vira "cancelado". O COALESCE só grava o motivo se o líder ainda
      // não tiver escrito uma observação. Se não houver check-in aberto,
      // pda_ativo não bate com nenhuma linha e o UPDATE não altera nada.
      const motivo = novo === 'bloqueado' ? 'Bloqueado pelo líder' : 'Enviado para manutenção';
      await conn.query(
        `UPDATE checkins
            SET status = IF(status = 'em_uso', 'finalizado', 'cancelado'),
                checkout_em = NOW(), lider_checkout_id = ?,
                observacao = COALESCE(observacao, ?)
          WHERE pda_ativo = ?`,
        [req.lider.id, motivo, pda.id]
      );
    }
    // Por fim, grava a nova situação do PDA
    await conn.query('UPDATE pdas SET status = ? WHERE id = ?', [novo, pda.id]);
    return { status: 200, corpo: { id: pda.id, numero_serie: pda.numero_serie, status: novo } };
  });
  res.status(resultado.status).json(resultado.corpo);
});

module.exports = router;