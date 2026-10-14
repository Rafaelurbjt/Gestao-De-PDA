const jwt = require('jsonwebtoken');

// Protege as rotas do modo Balcão: só passa quem mandar um token de líder válido
function exigeLider(req, res, next) {
  const [tipo, token] = String(req.headers.authorization || '').split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Faça login para continuar.' });
  }

  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET);
    req.lider = { id: dados.sub, nome: dados.nome };
    next();
  } catch (erro) {
    console.error('Token recusado:', erro.message);
    return res.status(401).json({ erro: 'Sessão expirada. Faça login novamente.' });
  }
}

module.exports = { exigeLider };