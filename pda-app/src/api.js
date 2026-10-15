// Chamada à API com tempo limite: se o PDA estiver fora do Wi-Fi da base,
// a chamada falha em poucos segundos em vez de ficar travada.
const TEMPO_LIMITE_MS = 6000;

export async function chamarApi(servidor, caminho, { metodo = 'GET', corpo, token, tokenLider } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);

  const headers = {};
  if (corpo) headers['Content-Type'] = 'application/json';
  if (token) headers['x-dispositivo-token'] = token;
  if (tokenLider) headers.Authorization = `Bearer ${tokenLider}`;

  try {
    const resposta = await fetch(`${servidor}${caminho}`, {
      method: metodo,
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controle.signal,
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      const erro = new Error(dados.erro || 'Algo deu errado. Tente de novo.');
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  } catch (e) {
    if (e.status) throw e;
    const erro = new Error('Sem conexão com o servidor. Confira se o PDA está no Wi-Fi da base.');
    erro.semConexao = true;
    throw erro;
  } finally {
    clearTimeout(timer);
  }
}

// Formata enquanto digita: "12345678909" -> "123.456.789-09"
export function formatarCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}