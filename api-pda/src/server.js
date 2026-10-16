/**
 * server.js
 *
 * Ponto de entrada da API: é este arquivo que o "node src/server.js" executa.
 * Monta o servidor Express, liga as rotas e fica escutando na porta.
 *
 * Fluxo de uma requisição:
 *   entra -> express.json() lê o corpo -> rota (com middleware de login)
 *         -> banco (db.js) -> resposta. Se algo falhar, vai para o tratador
 *         de erros no final deste arquivo.
 *
 * A ordem dos "app.use" importa: o Express passa por eles de cima para baixo.
 */

// A primeira linha precisa ser o dotenv: ele lê o .env e preenche process.env,
// que o db.js e os outros arquivos usam. Se vier depois, tudo chega undefined.
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

// Converte o corpo JSON das requisições em objeto (req.body). Precisa vir
// ANTES das rotas, senão req.body chega undefined.
app.use(express.json());

// Rota de saúde: confirma que a API está no ar e falando com o MySQL.
// Não exige login de propósito, para o iniciar.bat e o T.I. poderem testar.
app.get('/health', async (req, res) => {
  try {
    // Consulta simples que só funciona se o MySQL estiver ligado e acessível
    const [[linha]] = await pool.query(
      'SELECT NOW() AS hora_banco, (SELECT COUNT(*) FROM empresas) AS empresas'
    );
    res.json({ api: 'ok', banco: 'ok', ...linha });
  } catch (erro) {
    // A API está de pé, mas o banco não respondeu (por exemplo, MySQL desligado)
    res.status(500).json({ api: 'ok', banco: 'erro', detalhe: erro.message });
  }
});

// Cada grupo de rotas fica atrás de um prefixo: a rota "/login" de auth.js
// vira "/auth/login", e assim por diante
app.use('/auth', authRoutes);
app.use('/empresas', empresasRoutes);
app.use('/colaboradores', colaboradoresRoutes);
app.use('/pdas', pdasRoutes);
app.use('/checkins', checkinsRoutes);
app.use('/dispositivo', dispositivoRoutes);

// Qualquer erro não tratado cai aqui, em vez de derrubar a API.
// Precisa vir por último e ter exatamente 4 parâmetros (erro, req, res, next):
// é assim que o Express reconhece que esta função é um tratador de erros.
app.use((erro, req, res, next) => {
  // Corpo da requisição não é um JSON válido
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'Dados enviados em formato inválido.' });
  }
  // Valor repetido em campo único (CPF, nº de série, nome de empresa)
  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Já existe um cadastro com esse valor.' });
  }
  // Erro inesperado: o detalhe vai só para o log; a pessoa recebe uma mensagem genérica
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno no servidor.' });
});

// Porta do .env (padrão 3000). O '0.0.0.0' faz a API aceitar conexões de
// outros aparelhos da rede (o PDA); com '127.0.0.1' só o próprio PC acessaria.
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API rodando em http://localhost:${PORT}`);
});