const express = require('express');
const { pool } = require('../db');
const { exigeLider } = require('../middlewares/auth');
const { limparCpf, cpfValido } = require('../utils/cpf');

const router = express.Router();
router.use(exigeLider);

// GET /colaboradores?busca=joao -> lista (busca por nome ou CPF)
router.get('/', async (req, res) => {
  const busca = String(req.query.busca || '').trim();
  const cpfBusca = limparCpf(busca);
  const [lista] = await pool.query(
    `SELECT c.id, c.nome, c.cpf, c.vinculo, c.lider, e.id AS empresa_id, e.nome AS empresa
       FROM colaboradores c
       JOIN empresas e ON e.id = c.empresa_id
      WHERE c.ativo = 1
        AND (? = '' OR c.nome LIKE ? OR (? <> '' AND c.cpf LIKE ?))
      ORDER BY c.nome
      LIMIT 200`,
    [busca, `%${busca}%`, cpfBusca, `${cpfBusca}%`]
  );
  res.json(lista);
});

// POST /colaboradores { "nome", "cpf", "empresa_id" }
// O vínculo é automático: empresa própria (J&T) = CLT, terceirizada = diarista
router.post('/', async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const cpf = limparCpf(req.body.cpf);
  const empresaId = Number(req.body.empresa_id);

  if (nome.length < 3) return res.status(400).json({ erro: 'Informe o nome completo.' });
  if (!cpfValido(cpf)) return res.status(400).json({ erro: 'CPF inválido.' });

  const [[empresa]] = await pool.query(
    'SELECT id, tipo FROM empresas WHERE id = ? AND ativo = 1', [empresaId]
  );
  if (!empresa) return res.status(400).json({ erro: 'Escolha uma empresa da lista.' });

  const vinculo = empresa.tipo === 'propria' ? 'clt' : 'diarista';
  const [r] = await pool.query(
    'INSERT INTO colaboradores (empresa_id, nome, cpf, vinculo) VALUES (?, ?, ?, ?)',
    [empresa.id, nome, cpf, vinculo]
  );
  res.status(201).json({ id: r.insertId, nome, cpf, vinculo, empresa_id: empresa.id });
});

// PATCH /colaboradores/:id/desativar -> some da lista, histórico continua
router.patch('/:id/desativar', async (req, res) => {
  const id = Number(req.params.id);
  const [[aberto]] = await pool.query(
    'SELECT id FROM checkins WHERE colaborador_ativo = ?', [id]
  );
  if (aberto) {
    return res.status(409).json({ erro: 'Este colaborador está com um PDA. Faça o check-out antes.' });
  }
  const [r] = await pool.query('UPDATE colaboradores SET ativo = 0 WHERE id = ?', [id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Colaborador não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;