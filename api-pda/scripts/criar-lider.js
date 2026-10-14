//Uso: node scripts/criar-lider.js "Nome do Líder" 123.456.789-09
//O script pede a senha em seguida. Se o CPF já existir, ele vira líder.

require('dotenv').config();
const readline = require('readline');
const bscrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { limparCpf, cpfValido } = require('../src/utils/cpf');

function perguntar(texto) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((ok) => rl.question(texto, (r) => { rl.close(); ok(r.trim());        
    }));
}

async function main() {
    const [nome, cpfBruto] = process.argv.slice(2);
    if(!nome || !cpfBruto) {
        console.log('Uso: node scripts/criar-lider.js "Nome do Líder" 123.456.789-09');
        process.exit(1);
    }

    // Deixa o CPF só com números e confere se é valido
    const cpf = limparCpf(cpfBruto);
    if(!cpfValido(cpf)) {
        console.log('CPF inválido. Confira os números e tente de novo');
        process.exit(1);
    }

    // Pergunta a senha no terminal 
    const senha = await perguntar('Senha do líder (mínimo 6 caracteres): ');
    if ( senha.length < 6) {
        console.log('A senha precisa ter pelo menos 6 caracteres.');
        process.exit(1);
    }

    //Criptografa a senha (o banco nunca guarda a senha em texto)
    const senhaHash = await bscrypt.hash(senha, 10);

    //Líder do balcão é CLT da J&T
    const [[jt]] = await pool.query("SELECT id FROM empresas WHERE tipo = 'propria' LIMIT 1");
    if(!jt) {
        console.log("Nenhuma empresa 'propria' cadastrada. Rode o INSERT da J&T Express primeiro.");
        process.exit(1);
    }

    const [[existente]] = await pool.query('SELECT id FROM colaboradores WHERE cpf = ?', [cpf]);
    if (existente) {
        await pool.query(
            'UPDATE colaboradores SET nome = ?, lider = 1, senha_hash = ?, ativo = 1 WHERE id = ?',
            [nome, senhaHash, existente.id]
        );
        console.log(`Colaborador já existia (id ${existente.id}). Agora é lider, com a nova senha.`);
    } else {
        const [r] = await pool.query(
            `INSERT INTO colaboradores (empresa_id, nome, cpf, vinculo, lider, senha_hash)
            VALUES(?, ?, ?, 'clt', 1, ?)`,
            [jt.id, nome, cpf, senhaHash]
        );
        console.log(`Líder criado com id ${r.insertId}.`);
    }
    await pool.end();
}

main().catch(async(erro) => {
    console.error('Erro:', erro.message);
    await pool.end();
    process.exit(1);
});