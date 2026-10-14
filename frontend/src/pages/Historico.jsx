import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { mascararCpf } from '../utils'
import NovoColaborador from '../components/NovoColaborador'

export default function Cadastros() {
  const [colaboradores, setColaboradores] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [busca, setBusca] = useState('')
  const [aviso, setAviso] = useState(null)
  const [novoAberto, setNovoAberto] = useState(false)
  const [desativando, setDesativando] = useState(null) // id
  const [novaEmpresa, setNovaEmpresa] = useState('')

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

  useEffect(() => { carregarEmpresas() }, [carregarEmpresas])

  // Espera a pessoa parar de digitar (300 ms) antes de buscar na API
  useEffect(() => {
    const t = setTimeout(() => carregarColaboradores(busca), 300)
    return () => clearTimeout(t)
  }, [busca, carregarColaboradores])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  async function desativar(c) {
    try {
      await api(`/colaboradores/${c.id}/desativar`, { metodo: 'PATCH' })
      setDesativando(null)
      await carregarColaboradores(busca)
      setAviso({ tipo: 'ok', texto: `${c.nome} desativado. O histórico continua guardado.` })
    } catch (e) {
      setDesativando(null)
      setAviso({ tipo: 'erro', texto: e.message })
    }
  }

  async function cadastrarEmpresa(e) {
    e.preventDefault()
    if (novaEmpresa.trim().length < 2) return setAviso({ tipo: 'erro', texto: 'Digite o nome da empresa.' })
    try {
      const r = await api('/empresas', { metodo: 'POST', corpo: { nome: novaEmpresa.trim() } })
      setNovaEmpresa('')
      await carregarEmpresas()
      setAviso({ tipo: 'ok', texto: `${r.nome} cadastrada.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message === 'Já existe um cadastro com esse valor.' ? 'Essa empresa já está cadastrada.' : e.message })
    }
  }

  return (
    <section className="duas-colunas">
      <div>
        <div className="titulo-secao">
          <h2>Colaboradores</h2>
          <button className="botao botao-forte" onClick={() => setNovoAberto(true)}>+ Novo colaborador</button>
        </div>
        {aviso && <p className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</p>}
        <div className="barra">
          <input className="campo" placeholder="Buscar por nome ou CPF" value={busca}
            onChange={(e) => setBusca(e.target.value)} aria-label="Buscar colaborador" />
        </div>
        <div className="tabela-caixa">
          <table className="tabela">
            <thead><tr><th>Colaborador</th><th>Empresa</th><th className="col-acoes" /></tr></thead>
            <tbody>
              {colaboradores.length === 0 && <tr><td colSpan={3} className="vazio-linha">Ninguém encontrado.</td></tr>}
              {colaboradores.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="nome">{c.nome} {c.lider ? <span className="selo selo-lider">Líder</span> : null}</div>
                    <div className="cpf">{mascararCpf(c.cpf)}</div>
                  </td>
                  <td>{c.empresa} <span className="selo">{c.vinculo === 'clt' ? 'CLT' : 'Diarista'}</span></td>
                  <td className="col-acoes">
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