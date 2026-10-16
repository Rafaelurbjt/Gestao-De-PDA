/**
 * App.jsx
 *
 * Componente raiz do balcão (montado pelo main.jsx). Ele só decide
 * qual das duas telas mostrar:
 *   - sem sessão (ninguém logado)  -> Login
 *   - com sessão                   -> Layout (menu + abas do balcão)
 *
 * A "sessão" é { token, lider }, a mesma que o api.js guarda no navegador.
 */

import { useEffect, useState } from 'react'
import { lerSessao, limparSessao, quandoSessaoExpirar } from './api'
import Login from './pages/Login'
import Layout from './components/Layout'

export default function App() {
  // Estado inicial = a sessão guardada no navegador (ou null se não houver).
  // Repare que passamos "lerSessao" SEM parênteses: o React chama a função
  // uma única vez, só na primeira montagem. Com parênteses, ela rodaria a
  // cada redesenho. Por isso, recarregar a página não derruba o login.
  const [sessao, setSessao] = useState(lerSessao)

  // Se a API recusar o token (expirou), volta para o login
  // Registra no api.js o que fazer quando vier 401: limpar o estado daqui.
  // O api.js já apagou o token do navegador; falta só avisar o React.
  // Array vazio [] = registra uma vez, ao montar.
  useEffect(() => {
    quandoSessaoExpirar(() => setSessao(null))
  }, [])

  // Botão "Sair" do Layout: apaga a sessão do navegador e do estado
  function sair() {
    limparSessao()
    setSessao(null)
  }

  // Sem sessão: mostra o Login. Quando o login der certo, ele chama
  // aoEntrar(sessao), que aqui é o próprio setSessao, e a tela troca sozinha.
  if (!sessao) return <Login aoEntrar={setSessao} />
  // Com sessão: mostra o balcão, passando o líder (para exibir o nome) e a função de sair
  return <Layout lider={sessao.lider} aoSair={sair} />
}