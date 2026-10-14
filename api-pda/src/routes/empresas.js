const express = require('express');
const { pool } = require('../db');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();
router.use(exigeLider); // todas as rotas daqui exigem líder logado

// GET /empresas -> lista para o campo "Empresa" do cadastro
router.get('/', async (req, res) => {
  const [empresas] = await pool.query(
    "SELECT id, nome, tipo FROM empresas WHERE ativo = 1 ORDER BY tipo = 'propria' DESC, nome"
  );
  res.json(empresas);
});

// POST /empresas { "nome": "..." } -> nova terceirizada
router.post('/', async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  if (nome.length < 2) {
    return res.status(400).json({ erro: 'Informe o nome da empresa.' });
  }
  const [r] = await pool.query(
    "INSERT INTO empresas (nome, tipo) VALUES (?, 'terceirizada')", [nome]
  );
  res.status(201).json({ id: r.insertId, nome, tipo: 'terceirizada' });
});

module.exports = router;