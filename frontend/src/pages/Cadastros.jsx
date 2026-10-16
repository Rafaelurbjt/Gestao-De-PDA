/**
 * pages/Cadastros.jsx
 *
 * Aba "Cadastros" do balcão. Duas colunas:
 *   - Colaboradores: lista com busca, cadastro de novo colaborador e desativar
 *   - Empresas: lista e cadastro de nova empresa terceirizada
 *
 * Fala com a API nestas rotas (ver routes/colaboradores.js e routes/empresas.js):
 *   GET /colaboradores?busca=...   POST /colaboradores   PATCH /colaboradores/:id/desativar
 *   GET /empresas                  POST /empresas
 */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { mascararCpf } from '../utils'
import NovoColaborador from '../components/NovoColaborador'

export default function Cadastros() {
  // Estado = a memória da tela. Quando um deles muda, a tela é redesenhada.
  const [colaboradores, setColaboradores] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [busca, setBusca] = useState('')
  // Mensagem de sucesso ou erro no topo: { tipo: 'ok' | 'erro', texto } ou null
  const [aviso, setAviso] = useState(null)
  const [novoAberto, setNovoAberto] = useState(false) // janela "Novo colaborador"
  const [desativando, setDesativando] = useState(null) // id
  const [novaEmpresa, setNovaEmpresa] = useState('')

  // useCallback "congela" a função entre redesenhos. Sem isso, ela seria
  // recriada a cada redesenho e, listada nas dependências de um useEffect
  // abaixo, faria o efeito rodar de novo sem parar.
  // encodeURIComponent protege caracteres especiais (espaço, &, acentos) na URL.
  const carregarColaboradores = useCallback(async (termo = '') => {
    try {
      setColaboradores(await api(`/colaboradores?busca=${encodeURIComponent(termo)}`))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }, [])

  const carregarEmpresas = useCallback(async () => {
    try {
      setEmpresas(await api('/empresas'))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }, [])

  // Ao abrir a aba, carrega a lista de empresas uma vez
  useEffect(() => { carregarEmpresas() }, [carregarEmpresas])

  // Espera a pessoa parar de digitar (300 ms) antes de buscar na API
  // (técnica chamada "debounce"). A cada tecla, o efeito anterior é cancelado
  // pela função de limpeza (clearTimeout) e um novo relógio começa. Assim,
  // digitar "joao" faz uma busca, e não quatro. Também roda ao abrir a aba
  // (busca vazia), o que carrega a lista inicial.
  useEffect(() => {
    const t = setTimeout(() => carregarColaboradores(busca), 300)
    return () => clearTimeout(t)
  }, [busca, carregarColaboradores])

  // Some com o aviso sozinho depois de 4 segundos. Se um aviso novo chegar
  // antes, o relógio antigo é cancelado e recomeça.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  // Desativa o colaborador (a API recusa se ele estiver com um PDA)
  async function desativar(c) {
    try {
      await api(`/colaboradores/${c.id}/desativar`, { metodo: 'PATCH' })
      setDesativando(null) // fecha o "Confirmar / Cancelar"
      await carregarColaboradores(busca) // atualiza a lista, mantendo a busca
      setAviso({ tipo: 'ok', texto: `${c.nome} desativado. O histórico continua guardado.` })
    } catch (e) {
      setDesativando(null)
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  // Cadastra uma empresa terceirizada (a API fixa o tipo como 'terceirizada')
  async function cadastrarEmpresa(e) {
    e.preventDefault() // impede o navegador de recarregar a página
    if (novaEmpresa.trim().length < 2) return setAviso({ tipo: 'erro', texto: 'Digite o nome da empresa.' })
    try {
      const r = await api('/empresas', { metodo: 'POST', corpo: { nome: novaEmpresa.trim() } })
      setNovaEmpresa('') // limpa o campo
      await carregarEmpresas() // atualiza a lista
      setAviso({ tipo: 'ok', texto: `${r.nome} cadastrada.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message === 'Já existe um cadastro com esse valor.' ? 'Essa empresa já está cadastrada.' : e.message })
    }
  }

  return (
    <section className="duas-colunas">
      {/* Coluna da esquerda: colaboradores */}
      <div>
        <div className="titulo-secao">
          <h2>Colaboradores</h2>
          <button className="botao botao-forte" onClick={() => setNovoAberto(true)}>+ Novo colaborador</button>
        </div>
        {/* "cond && <algo/>" só mostra o aviso quando ele existe. role="status" faz leitores de tela anunciá-lo. */}
        {aviso && <p className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</p>}
        <div className="barra">
          <input className="campo" placeholder="Buscar por nome ou CPF" value={busca}
            onChange={(e) => setBusca(e.target.value)} aria-label="Buscar colaborador" />
        </div>
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Colaborador</th><th>Empresa</th><th className="col-acoes" /></tr></thead>
            <tbody>
              {/* Lista vazia: mostra uma linha avisando, ocupando as 3 colunas */}
              {colaboradores.length === 0 && <tr><td colSpan={3} className="vazio-linha">Ninguém encontrado.</td></tr>}
              {colaboradores.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="nome">{c.nome} {c.lider ? <span className="selo selo-lider">Líder</span> : null}</div>
                    {/* O CPF aparece mascarado na lista (privacidade) */}
                    <div className="cpf">{mascararCpf(c.cpf)}</div>
                  </td>
                  <td>{c.empresa} <span className="selo">{c.vinculo === 'clt' ? 'CLT' : 'Diarista'}</span></td>
                  <td className="col-acoes">
                    {/* Desativar em dois cliques: o primeiro guarda o id em
                        "desativando" e mostra Confirmar / Cancelar na linha. */}
                    {desativando === c.id ? (
                      <div className="acao-linha fim">
                        <button className="botao botao-perigo" onClick={() => desativar(c)}>Confirmar</button>
                        <button className="botao" onClick={() => setDesativando(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <button className="botao" onClick={() => setDesativando(c.id)}>Desativar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Coluna da direita: empresas */}
      <div>
        <div className="titulo-secao"><h2>Empresas</h2></div>
        <form className="linha-form" onSubmit={cadastrarEmpresa}>
          <input className="campo" placeholder="Nova empresa terceirizada" value={novaEmpresa}
            onChange={(e) => setNovaEmpresa(e.target.value)} aria-label="Nome da nova empresa" />
          <button className="botao botao-forte">Adicionar</button>
        </form>
        <div className="tabela-caixa">
          <table className="tabela">
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id}>
                  <td className="nome">{e.nome}</td>
                  <td className="direita"><span className="selo">{e.tipo === 'propria' ? 'CLT' : 'Diaristas'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* A janela de cadastro só existe na página enquanto novoAberto for verdadeiro */}
      {novoAberto && (
        <NovoColaborador
          aoFechar={() => setNovoAberto(false)}
          aoSalvar={async (nome) => {
            setNovoAberto(false)
            await carregarColaboradores(busca)
            setAviso({ tipo: 'ok', texto: `${nome} cadastrado.` })
          }}
        />
      )}
    </section>
  )
}