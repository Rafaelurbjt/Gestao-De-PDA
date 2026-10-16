/**
 * api.js
 *
 * Tudo que fala com a API passa por aqui: guarda o token do líder
 * e o envia automaticamente em cada chamada.
 *
 * Exporta:
 *   api(caminho, opções)   -> faz a chamada e devolve o JSON (ou lança erro)
 *   salvarSessao / lerSessao / limparSessao -> mexem no token guardado no navegador
 *   quandoSessaoExpirar(fn) -> o App registra o que fazer quando o token vence
 */

// Nomes das "gavetas" do localStorage onde a sessão fica guardada.
// O localStorage sobrevive a fechar a aba e a recarregar a página.
const CHAVE_TOKEN = 'balcao_token'
const CHAVE_LIDER = 'balcao_lider'

// Função que será chamada quando a API disser que o token venceu.
// Começa vazia; o App.jsx troca por uma que volta para o Login.
// Assim este arquivo não precisa conhecer o React.
let avisarSessaoExpirada = () => {}

// Permite ao App registrar a função acima
export function quandoSessaoExpirar(funcao) {
  avisarSessaoExpirada = funcao
}

// Lê a sessão guardada. Devolve { token, lider } ou null se não houver login.
// O localStorage só guarda texto, por isso o líder (um objeto) é convertido
// com JSON.parse. O "|| 'null'" evita erro quando a gaveta está vazia.
export function lerSessao() {
  const token = localStorage.getItem(CHAVE_TOKEN)
  const lider = JSON.parse(localStorage.getItem(CHAVE_LIDER) || 'null')
  return token && lider ? { token, lider } : null
}

// Guarda a sessão depois do login (objeto -> texto com JSON.stringify)
export function salvarSessao({ token, lider }) {
  localStorage.setItem(CHAVE_TOKEN, token)
  localStorage.setItem(CHAVE_LIDER, JSON.stringify(lider))
}

// Apaga a sessão (sair ou token vencido)
export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN)
  localStorage.removeItem(CHAVE_LIDER)
}

// Função usada por todas as telas para falar com a API:
// api('/pdas')  ou  api('/pdas', { metodo: 'POST', corpo: { ... } })
// Devolve o JSON da resposta. Se algo falhar, lança um Error com mensagem
// em português, que as telas mostram para a pessoa (e.message).
export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const token = localStorage.getItem(CHAVE_TOKEN)
  const headers = {}
  // Só avisa que está mandando JSON quando realmente há corpo
  if (corpo) headers['Content-Type'] = 'application/json'
  // Se há login, anexa o token em todas as chamadas (lido por middlewares/auth.js)
  if (token) headers.Authorization = `Bearer ${token}`

  let resposta
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    // fetch só falha aqui quando nem chegou ao servidor (rede caída, API desligada)
    throw new Error('Não foi possível falar com o servidor. Confira se a API está ligada.')
  }

  // 502/504: o site está no ar, mas a API não respondeu (desligada ou endereço errado)
  if (resposta.status === 502 || resposta.status === 504) {
    throw new Error('Não foi possível falar com o servidor. Confira se a API está ligada.')
  }

  // Lê o corpo como JSON. Se não for JSON, o catch devolve {} em vez de quebrar.
  const dados = await resposta.json().catch(() => ({}))

  // Token vencido ou inválido: volta para a tela de login
  // (o "&& token" evita tratar como "sessão vencida" o erro 401 do próprio login)
  if (resposta.status === 401 && token) {
    limparSessao()
    avisarSessaoExpirada()
  }
  // Qualquer status de erro (400, 404, 409, 500…): usa a mensagem enviada pela API
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Algo deu errado. Tente de novo.')
  }
  return dados
}