//  Remove pontos, traços e espaços: "123.456.789-09" -> "12345678909"
function limparCpf(valor) {
    return String(valor || '').replace(/\D/g, '');
}

//Confere os dois dígitos verificadores do CPF
function cpfValido(valor) {
    const cpf = limparCpf(valor);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    const digito = (base) => {
        let soma = 0;
        for (let i = 0; i < base.length; i++) {
            soma += Number(base[i]) * (base.length + 1 - i);
        }
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
    };
    
    return digito(cpf.slice(0, 9)) === Number(cpf[9])
        && digito(cpf.slice(0, 10)) === Number(cpf[10]);
}

module.exports = { limparCpf, cpfValido };