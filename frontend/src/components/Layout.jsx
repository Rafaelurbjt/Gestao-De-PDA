/**
 * components/Layout.jsx
 *
 * A "moldura" do balcão depois do login: barra do topo com o nome do líder,
 * as abas de navegação e a área onde aparece a tela escolhida.
 *
 * Quem o usa: App.jsx, que passa
 *   lider  -> objeto { id, nome } do líder logado
 *   aoSair -> função chamada ao clicar em "Sair" (o App apaga o token e volta ao login)
 */

import { useState } from 'react'
import CheckinCheckout from '../pages/CheckinCheckout'
import Pdas from '../pages/Pdas'
import Cadastros from '../pages/Cadastros'
import Historico from '../pages/Historico'

// Lista das abas. O "id" identifica a aba no código; o "nome" é o texto do botão.
// Para criar uma aba nova: acrescente aqui e adicione a tela na área "conteudo".
const ABAS = [
  { id: 'checkin', nome: 'Check-in / check-out' },
  { id: 'pdas', nome: 'PDAs' },
  { id: 'cadastros', nome: 'Cadastros' },
  { id: 'historico', nome: 'Histórico' },
]

export default function Layout({ lider, aoSair }) {
  // Guarda qual aba está aberta. Quando setAba muda o valor, o React redesenha
  // o componente com a nova aba. Começa em 'checkin', a tela do dia a dia.
  const [aba, setAba] = useState('checkin')

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          {/* aria-hidden: o ponto é só decoração, leitores de tela o ignoram */}
          <span className="marca-ponto" aria-hidden="true" />
          Controle de PDAs <span className="marca-sub">· Balcão</span>
        </div>
        <div className="topo-usuario">
          <span>{lider.nome}</span>
          <button className="botao" onClick={aoSair}>Sair</button>
        </div>
      </header>

      <nav className="abas" aria-label="Seções">
        {/* Um botão para cada item de ABAS. "key" ajuda o React a identificar
            cada botão da lista. */}
        {ABAS.map((a) => (
          <button
            key={a.id}
            // Aba aberta recebe a classe "ativa" (o CSS a destaca)
            className={`aba ${aba === a.id ? 'ativa' : ''}`}
            // Avisa leitores de tela qual é a página atual
            aria-current={aba === a.id ? 'page' : undefined}
            onClick={() => setAba(a.id)}
          >
            {a.nome}
          </button>
        ))}
      </nav>

      <main className="conteudo">
        {/* Só a tela da aba aberta existe na página. "cond && <Tela />" mostra
            a tela se a condição for verdadeira e nada se for falsa. */}
        {aba === 'checkin' && <CheckinCheckout />}
        {aba === 'pdas' && <Pdas />}
        {aba === 'cadastros' && <Cadastros />}
        {aba === 'historico' && <Historico />}
      </main>
    </div>
  )
}