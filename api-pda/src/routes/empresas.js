/**
 * routes/empresas.js
 *
 * Empresas dos colaboradores. Todas as rotas exigem líder logado.
 *
 *   GET  /empresas   lista as empresas ativas (alimenta o campo "Empresa" do cadastro)
 *   POST /empresas   cadastra uma nova empresa terceirizada
 *
 * O tipo da empresa define o vínculo do colaborador (ver colaboradores.js):
 *   'propria'      = J&T Express  -> colaborador CLT
 *   'terceirizada' = demais       -> colaborador diarista
 */

const express = require('express');
const { pool } = require('../db');
const { exigeLider } = require('../middlewares/auth');

const router = express.Router();
router.use(exigeLider); // todas as rotas daqui exigem líder logado

// GET /empresas -> lista para o campo "Empresa" do cadastro
router.get('/', async (req, res) => {
  // "tipo = 'propria'" vale 1 (verdadeiro) ou 0 (falso); com DESC, a empresa
  // própria (J&T) vem primeiro e as demais depois, em ordem alfabética
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
  // O tipo é fixo no código: por aqui só nascem terceirizadas. A empresa
  // própria (J&T) é criada uma vez, direto no banco, e ninguém cria outra
  // "própria" pelo site. Nome repetido é recusado pelo banco (UNIQUE) e o
  // server.js responde 409.
  const [r] = await pool.query(
    "INSERT INTO empresas (nome, tipo) VALUES (?, 'terceirizada')", [nome]
  );
  res.status(201).json({ id: r.insertId, nome, tipo: 'terceirizada' });
});

module.exports = router;