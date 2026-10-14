require('dotenv').config();
const express = require('express');
const { pool } = require('./db');
const authRoutes = require('./routes/auth');
const empresasRoutes = require('./routes/empresas');
const colaboradoresRoutes = require('./routes/colaboradores');
const pdasRoutes = require('./routes/pdas');
const checkinsRoutes = require('./routes/checkins');
const dispositivoRoutes = require('./routes/dispositivo');

const app = express();
app.use(express.json());

// Rota de saúde: confirma que a API está no ar e falando com o MySQL
app.get('/health', async (req, res) => {
  try {
    const [[linha]] = await pool.query(
      'SELECT NOW() AS hora_banco, (SELECT COUNT(*) FROM empresas) AS empresas'
    );
    res.json({ api: 'ok', banco: 'ok', ...linha });
  } catch (erro) {
    res.status(500).json({ api: 'ok', banco: 'erro', detalhe: erro.message });
  }
});

app.use('/auth', authRoutes);
app.use('/empresas', empresasRoutes);
app.use('/colaboradores', colaboradoresRoutes);
app.use('/pdas', pdasRoutes);
app.use('/checkins', checkinsRoutes);
app.use('/dispositivo', dispositivoRoutes);

// Qualquer erro não tratado cai aqui, em vez de derrubar a API
app.use((erro, req, res, next) => {
  // Corpo da requisição não é um JSON válido
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'Dados enviados em formato inválido.' });
  }
  // Valor repetido em campo único (CPF, nº de série, nome de empresa)
  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Já existe um cadastro com esse valor.' });
  }
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});