// Tudo que fala com a API passa por aqui: guarda o token do líder
// e o envia automaticamente em cada chamada.
const CHAVE_TOKEN = 'balcao_token'
const CHAVE_LIDER = 'balcao_lider'

let avisarSessaoExpirada = () => {}

export function quandoSessaoExpirar(funcao) {
  avisarSessaoExpirada = funcao
}

export function lerSessao() {
  const token = localStorage.getItem(CHAVE_TOKEN)
  const lider = JSON.parse(localStorage.getItem(CHAVE_LIDER) || 'null')
  return token && lider ? { token, lider } : null
}

export function salvarSessao({ token, lider }) {
  localStorage.setItem(CHAVE_TOKEN, token)
  localStorage.setItem(CHAVE_LIDER, JSON.stringify(lider))
}

export function limparSessao() {
  localStorage.removeItem(CHAVE_TOKEN)
  localStorage.removeItem(CHAVE_LIDER)
}

// api('/pdas')  ou  api('/pdas', { metodo: 'POST', corpo: { ... } })
export async function api(caminho, { metodo = 'GET', corpo } = {}) {
  const token = localStorage.getItem(CHAVE_TOKEN)
  const headers = {}
  if (corpo) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  let resposta
  try {
    resposta = await fetch(caminho, {
      method: metodo,
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new Error('Não foi possível falar com o servidor. Confira se a API está ligada.')
  }

  // 502/504: o site está no ar, mas a API não respondeu (desligada ou endereço errado)
  if (resposta.status === 502 || resposta.status === 504) {
    throw new Error('Não foi possível falar com o servidor. Confira se a API está ligada.')
  }

  const dados = await resposta.json().catch(() => ({}))

  // Token vencido ou inválido: volta para a tela de login
  if (resposta.status === 401 && token) {
    limparSessao()
    avisarSessaoExpirada()
  }
  if (!resposta.ok) {
    throw new Error(dados.erro || 'Algo deu errado. Tente de novo.')
  }
  return dados
}
