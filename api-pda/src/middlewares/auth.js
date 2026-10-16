/**
 * middlewares/auth.js
 *
 * Protege as rotas do balcão. Um "middleware" é uma função que roda ANTES da
 * rota: se estiver tudo certo, chama next() e a rota executa; se não, responde
 * com erro e a rota nunca é chamada.
 *
 * Como o login funciona:
 *   1. O líder faz login (POST /auth/login) e a API devolve um token JWT.
 *   2. O site guarda o token e o envia em toda requisição, no cabeçalho:
 *        Authorization: Bearer <token>
 *   3. Este middleware confere o token e libera ou barra a rota.
 *
 * Precisa de: JWT_SECRET no .env (a mesma chave usada para assinar o token
 * no login).
 */

const jwt = require('jsonwebtoken');

// Só passa quem mandar um token de líder válido.
// Uso numa rota: router.get('/painel', exigeLider, (req, res) => { ... })
function exigeLider(req, res, next) {
  // O cabeçalho vem como "Bearer abc123". Separa em duas partes pelo espaço:
  // tipo = "Bearer" e token = "abc123". O String(... || '') evita erro se o
  // cabeçalho não existir.
  const [tipo, token] = String(req.headers.authorization || '').split(' ');

  // Sem cabeçalho, ou em formato errado: o usuário nem tentou se identificar
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }

  try {
    // Confere se o token foi assinado com o nosso JWT_SECRET e se ainda não
    // expirou (12h). Se algo estiver errado, o verify lança um erro.
    const dados = jwt.verify(token, process.env.JWT_SECRET);

    // Guarda quem é o líder na requisição, para a rota usar depois
    // (por exemplo, registrar quem fez o check-in). "sub" é o campo padrão
    // do JWT para o id do usuário.
    req.lider = { id: dados.sub, nome: dados.nome };

    // Tudo certo: segue para a rota
    next();
  } catch (erro) {
    // Token falso, adulterado ou expirado. O motivo real vai só para o log
    // do servidor; o usuário recebe uma mensagem genérica.
    console.error('Token recusado:', erro.message);
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
}

module.exports = { exigeLider };