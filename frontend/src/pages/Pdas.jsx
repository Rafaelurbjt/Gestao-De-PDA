import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import Status from '../components/Status'

export default function Pdas() {
  const [pdas, setPdas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [aviso, setAviso] = useState(null)
  const [numeroSerie, setNumeroSerie] = useState('')
  const [modelo, setModelo] = useState('')
  const [confirmar, setConfirmar] = useState(null) // { pda, status }
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setPdas(await api('/pdas'))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
  }, [carregar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  // Modelos já usados viram sugestão no campo "Modelo"
  const modelos = useMemo(() => [...new Set(pdas.map((p) => p.modelo))].sort(), [pdas])

  async function cadastrar(e) {
    e.preventDefault()
    if (!numeroSerie.trim()) return setAviso({ tipo: 'erro', texto: 'Digite o número de série.' })
    if (!modelo.trim()) return setAviso({ tipo: 'erro', texto: 'Digite o modelo.' })
    setSalvando(true)
    try {
      const r = await api('/pdas', { metodo: 'POST', corpo: { numero_serie: numeroSerie, modelo } })
      setNumeroSerie('')
      await carregar()
      setAviso({ tipo: 'ok', texto: `${r.numero_serie} cadastrado.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message === 'Já existe um cadastro com esse valor.' ? 'Esse número de série já está cadastrado.' : e.message })
    } finally {
      setSalvando(false)
    }
  }

  async function mudarStatus(pda, status) {
    setSalvando(true)
    try {
      await api(`/pdas/${pda.id}/status`, { metodo: 'PATCH', corpo: { status } })
      setConfirmar(null)
      await carregar()
      const textos = { bloqueado: 'bloqueado', manutencao: 'enviado para manutenção', livre: 'liberado' }
      setAviso({ tipo: 'ok', texto: `${pda.numero_serie} ${textos[status]}.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setSalvando(false)
    }
  }

  // Bloquear ou mandar para manutenção um PDA com alguém pede confirmação
  function pedir(pda, status) {
    if (pda.colaborador) setConfirmar({ pda, status })
    else mudarStatus(pda, status)
  }

  if (carregando) return <p className="carregando">Carregando…</p>

  return (
    <section>
      <form className="painel-form" onSubmit={cadastrar}>
        <h2>Cadastrar PDA</h2>
        <div className="linha-form">
          <input className="campo" placeholder="Número de série (ex.: CT48-0012)" value={numeroSerie}
            onChange={(e) => setNumeroSerie(e.target.value.toUpperCase())} aria-label="Número de série" />
          <input className="campo" placeholder="Modelo (ex.: Urovo CT48)" value={modelo} list="lista-modelos"
            onChange={(e) => setModelo(e.target.value)} aria-label="Modelo" />
          <datalist id="lista-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
          <button className="botao botao-forte" disabled={salvando}>Cadastrar</button>
        </div>
      </form>

      {aviso && <p className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</p>}

      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr><th>Número de série</th><th>Modelo</th><th>Situação</th><th>Com quem</th><th className="col-acoes">Ações</th></tr>
          </thead>
          <tbody>
            {pdas.length === 0 && <tr><td colSpan={5} className="vazio-linha">Nenhum PDA cadastrado ainda.</td></tr>}
            {pdas.map((p) => (
              <tr key={p.id} className={confirmar?.pda.id === p.id ? 'editando' : ''}>
                <td className="nome">{p.numero_serie}</td>
                <td>{p.modelo}</td>
                <td><Status valor={p.status} /></td>
                <td>{p.colaborador || <span className="apagado">—</span>}</td>
                <td className="col-acoes">
                  {confirmar?.pda.id === p.id ? (
                    <div className="acao-linha fim">
                      <span className="pergunta">Isso encerra o uso de {p.colaborador}.</span>
                      <button className="botao botao-perigo" disabled={salvando} onClick={() => mudarStatus(p, confirmar.status)}>Confirmar</button>
                      <button className="botao" onClick={() => setConfirmar(null)}>Cancelar</button>
                    </div>
                  ) : (
                    <div className="acao-linha fim">
                      {['bloqueado', 'manutencao'].includes(p.status) ? (
                        <button className="botao" disabled={salvando} onClick={() => mudarStatus(p, 'livre')}>Liberar</button>
                      ) : (
                        <>
                          <button className="botao" disabled={salvando} onClick={() => pedir(p, 'bloqueado')}>Bloquear</button>
                          <button className="botao" disabled={salvando} onClick={() => pedir(p, 'manutencao')}>Manutenção</button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}