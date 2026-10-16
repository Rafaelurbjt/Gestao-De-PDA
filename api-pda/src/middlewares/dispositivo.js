/**
 * middlewares/dispositivo.js
 *
 * Protege as rotas do app do PDA. Aqui não existe login com CPF e senha:
 * quem se identifica é o próprio APARELHO, por meio de um token que o líder
 * gerou quando configurou o PDA (rota POST /dispositivo/registrar).
 *
 * Como funciona:
 *   1. No registro, a API cria um token aleatório e entrega ao PDA, que o
 *      guarda no próprio aparelho (SecureStore).
 *   2. O banco guarda só o HASH desse token (coluna pdas.token_hash).
 *   3. Em toda chamada, o PDA envia o token no cabeçalho
 *      "x-dispositivo-token". Este middleware calcula o hash, procura no
 *      banco e descobre qual PDA está chamando.
 *
 * Vantagem: se alguém vazar o banco, não consegue usar os tokens, porque só
 * existem os hashes.
 */

const crypto = require('crypto');
const { pool } = require('../db');

// Transforma o token em um "resumo" SHA-256 (64 caracteres hexadecimais).
// O mesmo token sempre dá o mesmo resumo, e não dá para voltar do resumo
// para o token. Por isso o banco guarda só o resumo; o token de verdade fica
// só no aparelho.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Identifica qual PDA está chamando e o coloca em req.pda para a rota usar.
// Uso numa rota: router.get('/status', exigeDispositivo, (req, res) => { ... })
async function exigeDispositivo(req, res, next) {
  // Lê o token do cabeçalho; sem ele vira '' (texto vazio), que cai no erro abaixo
  const token = String(req.headers['x-dispositivo-token'] || '');
  if (!token) {
    return res.status(401).json({ erro: 'Aparelho não configurado. Peça ao líder para configurar.' });
  }

  // Procura no banco o PDA cujo hash bate com o do token enviado.
  // O "?" é um parâmetro: o valor é passado separado do SQL, o que impede
  // injeção de SQL. O "ativo = 1" ignora PDAs desativados.
  const [[pda]] = await pool.query(
    'SELECT id, numero_serie, modelo, status FROM pdas WHERE token_hash = ? AND ativo = 1',
    [hashToken(token)]
  );

  // Nenhum PDA com esse token: token inventado, ou PDA desativado
  if (!pda) {
    return res.status(401).json({ erro: 'Aparelho não reconhecido. Peça ao líder para configurar de novo.' });
  }

  // Guarda o PDA na requisição (id, série, modelo e status) e segue para a rota
  req.pda = pda;
  next();
}

module.exports = { exigeDispositivo, hashToken };