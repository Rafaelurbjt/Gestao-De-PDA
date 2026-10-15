import { useState } from 'react'
import CheckinCheckout from '../pages/CheckinCheckout'
import Pdas from '../pages/Pdas'
import Cadastros from '../pages/Cadastros'
import Historico from '../pages/Historico'

const ABAS = [
  { id: 'checkin', nome: 'Check-in / check-out' },
  { id: 'pdas', nome: 'PDAs' },
  { id: 'cadastros', nome: 'Cadastros' },
  { id: 'historico', nome: 'Histórico' },
]

export default function 
Layout({ lider, aoSair }) {
  const [aba, setAba] = useState('checkin')

  return (
    <div className="app">
      <header className="topo">
        <div className="marca">
          <span className="marca-ponto" aria-hidden="true" />
          Controle de PDAs <span className="marca-sub">· Balcão</span>
        </div>
        <div className="topo-usuario">
          <span>{lider.nome}</span>
          <button className="botao" onClick={aoSair}>Sair</button>
        </div>
      </header>

      <nav className="abas" aria-label="Seções">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`aba ${aba === a.id ? 'ativa' : ''}`}
            aria-current={aba === a.id ? 'page' : undefined}
            onClick={() => setAba(a.id)}
          >
            {a.nome}
          </button>
        ))}
      </nav>

      <main className="conteudo">
        {aba === 'checkin' && <CheckinCheckout />}
        {aba === 'pdas' && <Pdas />}
        {aba === 'cadastros' && <Cadastros />}
        {aba === 'historico' && <Historico />}
      </main>
    </div>
  )
}