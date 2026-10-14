const express = require('express');
const crypto = require('crypto');
const { pool, transacao } = require('../db');
const { exigeLider } = require('../middlewares/auth');
const { exigeDispositivo, hashToken } = require('../middlewares/dispositivo');
const { limparCpf } = require('../utils/cpf');

const router = express.Router();

// POST /dispositivo/registrar { "numero_serie" }  (feito pelo LÍDER, uma vez por aparelho)
// Devolve o token que o app do PDA guarda. Registrar de novo invalida o token antigo.
router.post('/registrar', exigeLider, async (req, res) => {
  const numeroSerie = String(req.body.numero_serie || '').trim().toUpperCase();
  const token = crypto.randomBytes(32).toString('hex');

  const [r] = await pool.query(
    'UPDATE pdas SET token_hash = ? WHERE numero_serie = ? AND ativo = 1',
    [hashToken(token), numeroSerie]
  );
  if (!r.affectedRows) {
    return res.status(404).json({ erro: 'PDA não cadastrado. Cadastre o número de série primeiro.' });
  }
  res.json({ token, numero_serie: numeroSerie });
});

// Daqui para baixo, quem chama é o próprio aparelho
router.use(exigeDispositivo);

// GET /dispositivo/status -> o app consulta a cada poucos segundos para saber qual tela mostrar
//   livre / bloqueado / manutencao -> tela bloqueada
//   reservado                      -> tela "Digite seu CPF"
//   em_uso                         -> tela "Acesso liberado"
router.get('/status', async (req, res) => {
  const resposta = {
    numero_serie: req.pda.numero_serie,
    modelo: req.pda.modelo,
    status: req.pda.status,
    colaborador: null,
  };
  // O nome só aparece depois da confirmação: antes disso, quem pegar o
  // aparelho não descobre para quem ele foi liberado
  if (req.pda.status === 'em_uso') {
    const [[k]] = await pool.query(
      `SELECT c.nome, k.confirmado_em
         FROM checkins k JOIN colaboradores c ON c.id = k.colaborador_id
        WHERE k.pda_ativo = ? AND k.status = 'em_uso'`,
      [req.pda.id]
    );
    if (k) resposta.colaborador = { nome: k.nome, desde: k.confirmado_em };
  }
  res.json(resposta);
});

// POST /dispositivo/confirmar { "cpf" } -> colaborador digita o CPF no PDA
router.post('/confirmar', async (req, res) => {
  const cpf = limparCpf(req.body.cpf);

  const resultado = await transacao(async (conn) => {
    const [[k]] = await conn.query(
      `SELECT k.id, c.cpf, c.nome
         FROM checkins k JOIN colaboradores c ON c.id = k.colaborador_id
        WHERE k.pda_ativo = ? AND k.status = 'aguardando' FOR UPDATE`,
      [req.pda.id]
    );
    if (!k) return { status: 409, corpo: { erro: 'Este PDA não foi liberado. Procure o líder no balcão.' } };

    if (k.cpf !== cpf) {
      // Conta a tentativa errada (fica no histórico do check-in) e recusa
      await conn.query('UPDATE checkins SET cpf_errado_qtd = cpf_errado_qtd + 1 WHERE id = ?', [k.id]);
      return { status: 403, corpo: { erro: 'CPF não autorizado para este PDA.' } };
    }

    await conn.query(
      "UPDATE checkins SET status = 'em_uso', confirmado_em = NOW() WHERE id = ?", [k.id]
    );
    await conn.query("UPDATE pdas SET status = 'em_uso' WHERE id = ?", [req.pda.id]);
    return { status: 200, corpo: { ok: true, nome: k.nome } };
  });

  res.status(resultado.status).json(resultado.corpo);
});

// POST /dispositivo/encerrar -> o próprio colaborador devolve o PDA pelo aparelho
router.post('/encerrar', async (req, res) => {
  const resultado = await transacao(async (conn) => {
    const [[k]] = await conn.query(
      "SELECT id FROM checkins WHERE pda_ativo = ? AND status = 'em_uso' FOR UPDATE",
      [req.pda.id]
    );
    if (!k) return { status: 409, corpo: { erro: 'Não há uso em andamento neste PDA.' } };

    await conn.query(
      "UPDATE checkins SET status = 'finalizado', checkout_em = NOW() WHERE id = ?", [k.id]
    );
    await conn.query(
      "UPDATE pdas SET status = 'livre' WHERE id = ? AND status = 'em_uso'", [req.pda.id]
    );
    return { status: 200, corpo: { ok: true } };
  });
  res.status(resultado.status).json(resultado.corpo);
});

module.exports = router;