const express = require('express');
const { pool, transacao } = require('../db');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();
router.use(exigeLider);

// GET /pdas -> todos os PDAs e quem está com cada um agora
router.get('/', async (req, res) => {
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
  const numeroSerie = String(req.body.numero_serie || '').trim().toUpperCase();
  const modelo = String(req.body.modelo || '').trim();
  if (!numeroSerie) return res.status(400).json({ erro: 'Informe o número de série.' });
  if (!modelo) return res.status(400).json({ erro: 'Informe o modelo.' });

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
  if (!['bloqueado', 'manutencao', 'livre'].includes(novo)) {
    return res.status(400).json({ erro: 'Situação inválida.' });
  }

  const resultado = await transacao(async (conn) => {
    const [[pda]] = await conn.query(
      'SELECT id, numero_serie, status FROM pdas WHERE id = ? AND ativo = 1 FOR UPDATE', [pdaId]
    );
    if (!pda) return { status: 404, corpo: { erro: 'PDA não encontrado.' } };

    if (novo === 'livre') {
      if (!['bloqueado', 'manutencao'].includes(pda.status)) {
        return { status: 409, corpo: { erro: `O PDA ${pda.numero_serie} não está bloqueado nem em manutenção.` } };
      }
    } else {
      // Encerra o check-in aberto, se existir
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
    await conn.query('UPDATE pdas SET status = ? WHERE id = ?', [novo, pda.id]);
    return { status: 200, corpo: { id: pda.id, numero_serie: pda.numero_serie, status: novo } };
  });
  res.status(resultado.status).json(resultado.corpo);
});

module.exports = router;