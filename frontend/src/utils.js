// Formata enquanto digita: "12345678909" -> "123.456.789-09"
export function formatarCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

// Esconde o meio do CPF nas listas: "***.456.789-**"
export function mascararCpf(cpf) {
  const d = String(cpf || '')
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : ''
}
