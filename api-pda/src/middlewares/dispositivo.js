const crypto = require('crypto');
const { pool } = require('../db');

// O banco guarda só o "resumo" (hash) do token; o token de verdade fica só no aparelho
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Protege as rotas do modo PDA: identifica qual aparelho está chamando
async function exigeDispositivo(req, res, next) {
  const token = String(req.headers['x-dispositivo-token'] || '');
  if (!token) {
    return res.status(401).json({ erro: 'Aparelho não configurado. Peça ao líder para configurar.' });
  }
  const [[pda]] = await pool.query(
    'SELECT id, numero_serie, modelo, status FROM pdas WHERE token_hash = ? AND ativo = 1',
    [hashToken(token)]
  );
  if (!pda) {
    return res.status(401).json({ erro: 'Aparelho não reconhecido. Peça ao líder para configurar de novo.' });
  }
  req.pda = pda;
  next();
}

module.exports = { exigeDispositivo, hashToken };