/**
 * db.js
 *
 * Conexão com o MySQL, usada por todas as rotas.
 *   pool       -> para consultas simples: pool.query(...)
 *   transacao  -> para várias operações que precisam dar certo juntas
 *
 * Lê as configurações do .env (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 * Por isso o dotenv precisa ser carregado ANTES de este arquivo ser importado:
 * o server.js e o criar-lider.js já fazem isso na primeira linha.
 */

const mysql = require('mysql2/promise');

// Pool = conjunto de conexões reaproveitadas, em vez de abrir uma por requisição.
// connectionLimit: no máximo 10 conexões abertas ao mesmo tempo; se todas
// estiverem ocupadas, a próxima requisição espera uma ficar livre.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT), // o .env guarda tudo como texto, então converte para número
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

// Executa várias operações como uma só: ou tudo grava, ou nada grava.
// Uso: await transacao(async (conn) => { await conn.query(...); ... })
// IMPORTANTE: dentro da função use "conn", nunca "pool". O pool abriria outra
// conexão, fora da transação, e o rollback não a desfaria.
async function transacao(fn) {
  // Pega uma conexão só para esta transação (todas as operações precisam
  // passar pela mesma conexão)
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn); // roda as operações da rota
    await conn.commit();              // deu tudo certo: grava de verdade
    return resultado;
  } catch (erro) {
    await conn.rollback();            // algo falhou ou foi lançado: desfaz tudo
    throw erro;                       // repassa o erro para a rota tratar
  } finally {
    // Roda sempre, com sucesso ou erro: devolve a conexão ao pool.
    // Sem isso, as 10 conexões acabariam e a API travaria.
    conn.release();
  }
}

module.exports = { pool, transacao };