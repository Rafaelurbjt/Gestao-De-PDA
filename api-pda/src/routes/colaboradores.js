/**
 * routes/colaboradores.js
 *
 * Cadastro de colaboradores (CLT e diaristas). Todas as rotas exigem líder logado.
 *
 *   GET   /colaboradores?busca=...   lista, buscando por nome ou CPF
 *   POST  /colaboradores             cadastra um colaborador
 *   PATCH /colaboradores/:id/desativar   tira da lista sem apagar o histórico
 *
 * O cadastro é enxuto de propósito: nome, CPF e empresa. O vínculo (CLT ou
 * diarista) não é digitado, é deduzido da empresa escolhida.
 */

const express = require('express');
const { pool } = require('../db');
const { exigeLider } = require('../middlewares/auth');
const { limparCpf, cpfValido } = require('../utils/cpf');

const router = express.Router();

// Todas as rotas deste arquivo passam antes pelo middleware de login do líder
router.use(exigeLider);

// GET /colaboradores?busca=joao -> lista (busca por nome ou CPF)
router.get('/', async (req, res) => {
  const busca = String(req.query.busca || '').trim();
  // Se a busca for um CPF (com ou sem pontuação), fica só com os números.
  // Se for um nome como "joao", limparCpf devolve '' (texto vazio).
  const cpfBusca = limparCpf(busca);

  // Só traz ativos. Os "?" mantêm os valores separados do SQL (evita injeção).
  //  - (? = '')                 busca vazia: não filtra nada
  //  - c.nome LIKE '%texto%'    nome contém o texto, em qualquer posição
  //  - (? <> '' AND c.cpf LIKE ?)  CPF começa com os números digitados; o teste
  //    "<> ''" evita que um nome (cpfBusca vazio) vire LIKE '%' e traga todo mundo
  // LIMIT 200 protege a tela de uma lista enorme.
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
  // Limpa e converte o que veio do site; nada que vem de fora é confiável
  const nome = String(req.body.nome || '').trim();
  const cpf = limparCpf(req.body.cpf);
  const empresaId = Number(req.body.empresa_id);

  // 400 = dados inválidos. cpfValido confere os dígitos verificadores.
  if (nome.length < 3) return res.status(400).json({ erro: 'Informe o nome completo.' });
  if (!cpfValido(cpf)) return res.status(400).json({ erro: 'CPF inválido.' });

  // A empresa precisa existir e estar ativa; o "tipo" decide o vínculo
  const [[empresa]] = await pool.query(
    'SELECT id, tipo FROM empresas WHERE id = ? AND ativo = 1', [empresaId]
  );
  if (!empresa) return res.status(400).json({ erro: 'Escolha uma empresa da lista.' });

  const vinculo = empresa.tipo === 'propria' ? 'clt' : 'diarista';

  // Se o CPF já existir, o banco recusa (coluna UNIQUE) e o tratador de erros
  // do server.js responde 409 ("Já existe um cadastro com esse valor.")
  const [r] = await pool.query(
    'INSERT INTO colaboradores (empresa_id, nome, cpf, vinculo) VALUES (?, ?, ?, ?)',
    [empresa.id, nome, cpf, vinculo]
  );
  res.status(201).json({ id: r.insertId, nome, cpf, vinculo, empresa_id: empresa.id });
});

// PATCH /colaboradores/:id/desativar -> some da lista, histórico continua
// Não apagamos o registro (DELETE): os check-ins antigos dependem dele.
// Desativar só troca ativo para 0.
router.patch('/:id/desativar', async (req, res) => {
  const id = Number(req.params.id);

  // Quem está com um PDA não pode ser desativado: primeiro o check-out.
  // colaborador_ativo só tem valor enquanto o check-in está aberto.
  const [[aberto]] = await pool.query(
    'SELECT id FROM checkins WHERE colaborador_ativo = ?', [id]
  );
  if (aberto) {
    return res.status(409).json({ erro: 'Este colaborador está com um PDA. Faça o check-out antes.' });
  }

  // affectedRows = quantas linhas o UPDATE alterou; 0 significa que o id não existe
  const [r] = await pool.query('UPDATE colaboradores SET ativo = 0 WHERE id = ?', [id]);
  if (!r.affectedRows) return res.status(404).json({ erro: 'Colaborador não encontrado.' });
  res.json({ ok: true });
});

module.exports = router;