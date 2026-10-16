/**
 * Funções de apoio do app do PDA (mesma ideia do api.js e do utils.js do balcão):
 *   chamarApi    -> faz as chamadas à API, com tempo limite
 *   formatarCpf  -> coloca pontos e traço no CPF enquanto a pessoa digita
 */

// Chamada à API com tempo limite: se o PDA estiver fora do Wi-Fi da base,
// a chamada falha em poucos segundos em vez de ficar travada.
const TEMPO_LIMITE_MS = 6000;

// Parâmetros:
//   servidor   -> endereço da API, ex.: "http://172.16.50.182:3000" (guardado na configuração do PDA)
//   caminho    -> ex.: "/dispositivo/estado"
//   metodo     -> GET (padrão), POST...
//   corpo      -> objeto que vira JSON no envio
//   token      -> token do aparelho; vai no cabeçalho x-dispositivo-token (lido por middlewares/dispositivo.js)
//   tokenLider -> token do líder (PIN de administrador); vai em Authorization: Bearer
export async function chamarApi(servidor, caminho, { metodo = 'GET', corpo, token, tokenLider } = {}) {
  // AbortController é o "botão de cancelar" do fetch. O setTimeout o aperta
  // depois de 6 segundos; o fetch então falha com erro de cancelamento.
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
      signal: controle.signal, // liga o fetch ao "botão de cancelar"
    });
    // Se a resposta não for JSON, o catch devolve {} em vez de quebrar
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) {
      // A API respondeu, mas com erro (400, 401, 409…): guarda o status no erro
      // para as telas poderem decidir o que fazer (ex.: 401 = token do aparelho inválido)
      const erro = new Error(dados.erro || 'Algo deu errado. Tente de novo.');
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  } catch (e) {
    // Erro que veio da API (tem status): repassa como está
    if (e.status) throw e;
    // Sem status = nem chegou ao servidor (fora do Wi-Fi, API desligada ou tempo esgotado).
    // semConexao = true permite à tela mostrar o aviso certo.
    const erro = new Error('Sem conexão com o servidor. Confira se o PDA está no Wi-Fi da base.');
    erro.semConexao = true;
    throw erro;
  } finally {
    // Roda sempre: desliga o relógio, para não cancelar uma chamada que já terminou
    clearTimeout(timer);
  }
}

// Formata enquanto digita: "12345678909" -> "123.456.789-09"
// (igual à do balcão; ver utils.js do frontend para a explicação passo a passo)
export function formatarCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}