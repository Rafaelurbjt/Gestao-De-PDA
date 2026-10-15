/**
 * criar-lider.js
 *
 * Cria o primeiro líder (ou promove um colaborador existente a líder).
 * O líder é quem entra no balcão para cadastrar colaboradores e PDAs.
 *
 * Uso:
 *   node scripts/criar-lider.js "Nome do Líder" 123.456.789-09
 *
 * O nome e o CPF vão na linha de comando; a senha é perguntada em seguida.
 * Se o CPF já existir, o colaborador vira líder e recebe a nova senha.
 *
 * Precisa de: MySQL ligado, .env configurado e a empresa J&T Express
 * (tipo 'propria') já cadastrada.
 *
 * Atenção: a senha digitada aparece na tela. Rode em um terminal privado.
 */

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { limparCpf, cpfValido } = require('../src/utils/cpf');

// Faz uma pergunta no terminal e devolve o que a pessoa digitou (sem espaços nas pontas)
function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((ok) => rl.question(texto, (r) => { rl.close(); ok(r.trim()); }));
}

async function main() {
  // Nome e CPF vêm da linha de comando, depois do nome do arquivo.
  // Se algum faltar, mostra como usar e encerra com erro.
  const [nome, cpfBruto] = process.argv.slice(2);
  if (!nome || !cpfBruto) {
    console.log('Uso: node scripts/criar-lider.js "Nome do Líder" 123.456.789-09');
    process.exit(1);
  }

  // Deixa o CPF só com números e confere os dígitos verificadores
  const cpf = limparCpf(cpfBruto);
  if (!cpfValido(cpf)) {
    console.log('CPF inválido. Confira os números e tente de novo.');
    process.exit(1);
  }

  // Pergunta a senha no terminal e exige o mínimo de 6 caracteres
  const senha = await perguntar('Senha do líder (mínimo 6 caracteres): ');
  if (senha.length < 6) {
    console.log('A senha precisa ter pelo menos 6 caracteres.');
    process.exit(1);
  }

  // Transforma a senha em hash: o banco nunca guarda a senha em texto
  const senhaHash = await bcrypt.hash(senha, 10);

  // O líder do balcão é CLT da J&T, então precisamos do id da empresa 'propria'
  const [[jt]] = await pool.query("SELECT id FROM empresas WHERE tipo = 'propria' LIMIT 1");
  if (!jt) {
    console.log("Nenhuma empresa 'propria' cadastrada. Rode o INSERT da J&T Express primeiro.");
    process.exit(1);
  }

  // Se o CPF já existe, promove a líder e troca a senha; se não, cria o colaborador
  const [[existente]] = await pool.query('SELECT id FROM colaboradores WHERE cpf = ?', [cpf]);
  if (existente) {
    await pool.query(
      'UPDATE colaboradores SET nome = ?, lider = 1, senha_hash = ?, ativo = 1 WHERE id = ?',
      [nome, senhaHash, existente.id]
    );
    console.log(`Colaborador já existia (id ${existente.id}). Agora é líder, com a nova senha.`);
  } else {
    const [r] = await pool.query(
      `INSERT INTO colaboradores (empresa_id, nome, cpf, vinculo, lider, senha_hash)
       VALUES (?, ?, ?, 'clt', 1, ?)`,
      [jt.id, nome, cpf, senhaHash]
    );
    console.log(`Líder criado com id ${r.insertId}.`);
  }

  // Fecha a conexão com o banco para o script poder terminar
  await pool.end();
}

// Roda a main; qualquer erro cai aqui, mostra a mensagem e encerra com falha
main().catch(async (erro) => {
  console.error('Erro:', erro.message);
  await pool.end();
  process.exit(1);
});