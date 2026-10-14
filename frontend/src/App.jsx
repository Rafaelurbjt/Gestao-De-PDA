import { useEffect, useState } from 'react'
import { lerSessao, limparSessao, quandoSessaoExpirar } from './api'
import Login from './pages/Login'
import Layout from './components/Layout'

export default function App() {
  const [sessao, setSessao] = useState(lerSessao)

  // Se a API recusar o token (expirou), volta para o login
  useEffect(() => {
    quandoSessaoExpirar(() => setSessao(null))
  }, [])

  function sair() {
    limparSessao()
    setSessao(null)
  }

  if (!sessao) return <Login aoEntrar={setSessao} />
  return <Layout lider={sessao.lider} aoSair={sair} />
}
