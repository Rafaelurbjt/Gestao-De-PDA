/**
 * routes/auth.js
 *
 * Rotas de autenticação do balcão (só líderes entram).
 *   POST /auth/login  -> confere CPF e senha e devolve um token JWT
 *   GET  /auth/eu     -> confirma se o token ainda vale e diz quem está logado
 *
 * O token devolvido no login é o que o middleware exigeLider confere depois,
 * em todas as outras rotas do balcão.
 *
 * Precisa de: JWT_SECRET e, se quiser, JWT_EXPIRA no .env (padrão 12h).
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { limparCpf } = require('../utils/cpf');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();

// POST /auth/login  { "cpf": "...", "senha": "..." }
router.post('/login', async (req, res) => {
  // Deixa o CPF só com números (aceita com ou sem pontos e traço).
  // String(... || '') garante que a senha é texto mesmo se vier vazia.
  const cpf = limparCpf(req.body.cpf);
  const senha = String(req.body.senha || '');

  // 400 = a requisição veio incompleta (diferente de 401, senha errada)
  if (!cpf || !senha) {
    return res.status(400).json({ erro: 'Informe CPF e senha.' });
  }

  // Busca só quem é líder (lider = 1) e está ativo. Colaborador comum não
  // tem senha e não entra por aqui. O "?" separa o valor do SQL, o que
  // impede injeção de SQL.
  const [[lider]] = await pool.query(
    'SELECT id, nome, senha_hash FROM colaboradores WHERE cpf = ? AND lider = 1 AND ativo = 1',
    [cpf]
  );

  // Mesma mensagem para CPF inexistente e senha errada: não revela quem é líder.
  // O "lider && ..." evita comparar a senha quando o CPF nem foi encontrado.
  // bcrypt.compare refaz o hash da senha digitada e compara com o do banco.
  const senhaConfere = lider && await bcrypt.compare(senha, lider.senha_hash);
  if (!senhaConfere) {
    return res.status(401).json({ erro: 'CPF ou senha incorretos.' });
  }

  // Cria o token assinado com o JWT_SECRET. Guarda o id (sub) e o nome, que o
  // middleware exigeLider lê depois. Expira em JWT_EXPIRA (padrão 12h):
  // depois disso o líder precisa entrar de novo.
  const token = jwt.sign(
    { sub: lider.id, nome: lider.nome },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRA || '12h' }
  );
  res.json({ token, lider: { id: lider.id, nome: lider.nome } });
});

// GET /auth/eu -> testa se o token é válido e diz quem está logado.
// O exigeLider roda antes: se o token for ruim, nem chega aqui.
router.get('/eu', exigeLider, (req, res) => {
  res.json({ lider: req.lider });
});

module.exports = router;