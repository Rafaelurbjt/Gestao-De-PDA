import { useState } from 'react'
import { api, salvarSessao } from '../api'
import { formatarCpf } from '../utils'

export default function Login({ aoEntrar }) {
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento) {
    evento.preventDefault()
    setErro('')
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Digite os 11 números do CPF.')
    if (!senha) return setErro('Digite a senha.')

    setEnviando(true)
    try {
      const sessao = await api('/auth/login', { metodo: 'POST', corpo: { cpf, senha } })
      salvarSessao(sessao)
      aoEntrar(sessao)
    } catch (e) {
      setErro(e.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <form className="login-cartao" onSubmit={entrar} noValidate>
        <div className="marca">
          <span className="marca-ponto" aria-hidden="true" />
          Controle de PDAs
        </div>
        <h1>Entrar no balcão</h1>
        <p className="sub">Acesso dos líderes e responsáveis pelo balcão.</p>

        <label htmlFor="cpf">CPF</label>
        <input
          id="cpf"
          inputMode="numeric"
          autoComplete="username"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
          autoFocus
        />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && <p className="erro" role="alert">{erro}</p>}

        <button className="botao-principal" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
