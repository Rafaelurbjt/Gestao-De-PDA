/**
 * utils.js
 *
 * Funções pequenas de formatação usadas em mais de uma tela:
 *   formatarCpf  -> usada no campo de CPF (Login, NovoColaborador)
 *   mascararCpf  -> usada nas listas (Cadastros, CheckinCheckout)
 */

// Formata enquanto digita: "12345678909" -> "123.456.789-09"
export function formatarCpf(valor) {
  // String(valor || '') garante texto mesmo se vier undefined ou null.
  // replace(/\D/g, '') remove tudo que não é dígito (\D = "não dígito").
  // slice(0, 11) corta em 11 dígitos, o tamanho de um CPF.
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  // Os três replace colocam a pontuação em etapas. Cada um só age quando já
  // há dígitos suficientes, por isso o CPF "cresce" certinho enquanto se digita:
  //   1) 4+ dígitos: coloca o primeiro ponto  -> 123.4
  //   2) 7+ dígitos: coloca o segundo ponto   -> 123.456.7
  //   3) 10+ dígitos: coloca o traço          -> 123.456.789-0
  // Em cada regex, (\d{3}) captura um grupo e $1, $2, $3 o reinserem no resultado.
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

// Esconde o meio do CPF nas listas: "***.456.789-**"
// Só os 6 dígitos do meio aparecem (privacidade nas telas do balcão).
// Se o CPF não tiver exatamente 11 dígitos, devolve texto vazio.
export function mascararCpf(cpf) {
  const d = String(cpf || '')
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : ''
}