const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { limparCpf } = require('../utils/cpf');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();

// POST /auth/login  { "cpf": "...", "senha": "..." }
router.post('/login', async (req, res) => {
  const cpf = limparCpf(req.body.cpf);
  const senha = String(req.body.senha || '');
  if (!cpf || !senha) {
    return res.status(400).json({ erro: 'Informe CPF e senha.' });
  }

  const [[lider]] = await pool.query(
    'SELECT id, nome, senha_hash FROM colaboradores WHERE cpf = ? AND lider = 1 AND ativo = 1',
    [cpf]
  );

  // Mesma mensagem para CPF inexistente e senha errada: não revela quem é líder
  const senhaConfere = lider && await bcrypt.compare(senha, lider.senha_hash);
  if (!senhaConfere) {
    return res.status(401).json({ erro: 'CPF ou senha incorretos.' });
  }

  const token = jwt.sign(
    { sub: lider.id, nome: lider.nome },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRA || '12h' }
  );
  res.json({ token, lider: { id: lider.id, nome: lider.nome } });
});

// GET /auth/eu  -> testa se o token é válido e diz quem está logado
router.get('/eu', exigeLider, (req, res) => {
  res.json({ lider: req.lider });
});

module.exports = router;