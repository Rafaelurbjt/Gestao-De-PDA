/**
 * pages/Login.jsx
 *
 * Tela de entrada do balcão. O líder digita CPF e senha; se estiverem certos,
 * a API devolve um token e o App.jsx passa a mostrar o Layout.
 *
 * Prop:
 *   aoEntrar -> função chamada depois do login, com os dados da sessão
 *               (token e líder). Quem decide o que mostrar é o App.jsx.
 *
 * Rota usada: POST /auth/login (ver routes/auth.js)
 */

import { useState } from 'react'
import { api, salvarSessao } from '../api'
import { formatarCpf } from '../utils'

export default function Login({ aoEntrar }) {
  // O que o líder digita, mais o erro e o estado "enviando"
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento) {
    // Impede o navegador de recarregar a página ao enviar o formulário
    evento.preventDefault()
    setErro('')
    // Conferências rápidas antes de chamar a API (a API confere de novo)
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Digite os 11 números do CPF.')
    if (!senha) return setErro('Digite a senha.')

    setEnviando(true) // desabilita o botão para evitar cliques repetidos
    try {
      const sessao = await api('/auth/login', { metodo: 'POST', corpo: { cpf, senha } })
      salvarSessao(sessao) // guarda o token para as próximas chamadas (ver api.js)
      aoEntrar(sessao)     // avisa o App, que troca para a tela principal
    } catch (e) {
      // Mostra a mensagem da API (por exemplo, "CPF ou senha incorretos.")
      setErro(e.message)
    } finally {
      // Roda sempre: libera o botão, com sucesso ou erro
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      {/* noValidate desliga as mensagens padrão do navegador; usamos as nossas */}
      <form className="login-cartao" onSubmit={entrar} noValidate>
        <div className="marca">
          {/* aria-hidden: o ponto é só decoração, leitores de tela o ignoram */}
          <span className="marca-ponto" aria-hidden="true" />
          Controle de PDAs
        </div>
        <h1>Entrar no balcão</h1>
        <p className="sub">Acesso dos líderes e responsáveis pelo balcão.</p>

        {/* htmlFor liga o texto ao campo: clicar no texto foca o campo */}
        <label htmlFor="cpf">CPF</label>
        <input
          id="cpf"
          inputMode="numeric"
          // autoComplete ajuda o navegador e gerenciadores de senha a
          // preencher e salvar o par usuário/senha corretamente
          autoComplete="username"
          placeholder="000.000.000-00"
          value={cpf}
          // formatarCpf coloca os pontos e o traço enquanto a pessoa digita
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
          autoFocus
        />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password" // esconde os caracteres digitados
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {/* Só aparece se houver erro. role="alert" faz o leitor de tela anunciá-lo. */}
        {erro && <p className="erro" role="alert">{erro}</p>}

        <button className="botao-principal" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}