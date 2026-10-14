import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { mascararCpf } from '../utils'
import NovoColaborador from '../components/NovoColaborador'

const ATUALIZAR_A_CADA_MS = 5000

// "2026-10-14T10:02:00Z" -> "07:02" (ou "13/10 07:02" se não for hoje)
function hora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const hoje = new Date().toDateString() === d.toDateString()
  return hoje ? hhmm : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hhmm}`
}

export default function CheckinCheckout() {
  const [painel, setPainel] = useState([])
  const [pdas, setPdas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'erro', texto }

  const [busca, setBusca] = useState('')
  const [empresa, setEmpresa] = useState('')

  // Linha em edição: { colaboradorId, modo: 'checkin' | 'checkout', pdaId, observacao }
  const [edicao, setEdicao] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([api('/checkins/painel'), api('/pdas')])
      setPainel(p)
      setPdas(d)
      setErroCarga('')
    } catch (e) {
      setErroCarga(e.message)
    } finally {
      setCarregando(false)
    }
  }, [])

  // Carrega ao abrir e atualiza sozinho a cada 5 s (para ver a confirmação do CPF no PDA)
  useEffect(() => {
    carregar()
    const timer = setInterval(carregar, ATUALIZAR_A_CADA_MS)
    return () => clearInterval(timer)
  }, [carregar])

  // Some com o aviso depois de alguns segundos
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  const contagem = useMemo(() => {
    const c = { livre: 0, reservado: 0, em_uso: 0, bloqueado: 0 }
    pdas.forEach((p) => { if (c[p.status] !== undefined) c[p.status]++ })
    return c
  }, [pdas])

  const pdasLivres = useMemo(() => pdas.filter((p) => p.status === 'livre'), [pdas])
  const empresas = useMemo(() => [...new Set(painel.map((l) => l.empresa))].sort(), [painel])

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const digitos = busca.replace(/\D/g, '')
    return painel.filter((l) => {
      if (empresa && l.empresa !== empresa) return false
      if (!termo) return true
      return l.nome.toLowerCase().includes(termo) || (digitos && l.cpf.startsWith(digitos))
    })
  }, [painel, busca, empresa])

  function clicarCheckbox(linha) {
    if (salvando) return
    if (linha.com_pda) {
      setEdicao({ colaboradorId: linha.colaborador_id, modo: 'checkout', observacao: '' })
    } else {
      setEdicao({ colaboradorId: linha.colaborador_id, modo: 'checkin', pdaId: '' })
    }
  }

  async function confirmarCheckin(linha) {
    if (!edicao.pdaId) return setAviso({ tipo: 'erro', texto: 'Escolha um PDA livre.' })
    setSalvando(true)
    try {
      const r = await api('/checkins', {
        metodo: 'POST',
        corpo: { colaborador_id: linha.colaborador_id, pda_id: Number(edicao.pdaId) },
      })
      await carregar()
      setEdicao(null)
      setAviso({ tipo: 'ok', texto: `${r.pda} entregue para ${r.colaborador}. Aguardando o CPF no aparelho.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
      await carregar()
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarCheckout(linha) {
    setSalvando(true)
    try {
      await api(`/checkins/${linha.checkin_id}/checkout`, {
        metodo: 'POST',
        corpo: { observacao: edicao.observacao },
      })
      await carregar()
      setEdicao(null)
      setAviso({ tipo: 'ok', texto: `Check-out de ${linha.nome} feito. ${linha.pda} está livre.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <p className="carregando">Carregando…</p>

  return (
    <section>
      <div className="resumo">
        <Cartao rotulo="Livres" valor={contagem.livre} />
        <Cartao rotulo="Aguardando CPF" valor={contagem.reservado} tom="alerta" />
        <Cartao rotulo="Em uso" valor={contagem.em_uso} tom="info" />
        <Cartao rotulo="Bloqueados" valor={contagem.bloqueado} tom="perigo" />
      </div>

      {erroCarga && <p className="erro" role="alert">{erroCarga}</p>}
      {aviso && <p className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</p>}

      <div className="barra">
        <input
          className="campo"
          placeholder="Buscar por nome ou CPF"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar colaborador"
        />
        <select className="campo" value={empresa} onChange={(e) => setEmpresa(e.target.value)} aria-label="Filtrar por empresa">
          <option value="">Todas as empresas</option>
          {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button className="botao" onClick={() => setNovoAberto(true)}>+ Novo colaborador</button>
      </div>

      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr>
              <th className="col-check" aria-label="Com PDA" />
              <th>Colaborador</th>
              <th>Empresa</th>
              <th>PDA</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr><td colSpan={5} className="vazio-linha">
                {painel.length === 0 ? 'Nenhum colaborador cadastrado ainda. Use "+ Novo colaborador".' : 'Ninguém encontrado com esse filtro.'}
              </td></tr>
            )}
            {linhas.map((l) => {
              const editando = edicao?.colaboradorId === l.colaborador_id
              return (
                <tr key={l.colaborador_id} className={editando ? 'editando' : ''}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={editando ? edicao.modo === 'checkin' : l.com_pda}
                      onChange={() => clicarCheckbox(l)}
                      aria-label={l.com_pda ? `Fazer check-out de ${l.nome}` : `Fazer check-in de ${l.nome}`}
                    />
                  </td>
                  <td>
                    <div className="nome">{l.nome}</div>
                    <div className="cpf">{mascararCpf(l.cpf)}</div>
                  </td>
                  <td>
                    {l.empresa} <span className="selo">{l.vinculo === 'clt' ? 'CLT' : 'Diarista'}</span>
                  </td>

                  {editando && edicao.modo === 'checkin' ? (
                    <td colSpan={2}>
                      <div className="acao-linha">
                        <select
                          className="campo"
                          value={edicao.pdaId}
                          onChange={(e) => setEdicao({ ...edicao, pdaId: e.target.value })}
                          aria-label="PDA a entregar"
                          autoFocus
                        >
                          <option value="">
                            {pdasLivres.length ? 'Escolha o PDA livre…' : 'Nenhum PDA livre agora'}
                          </option>
                          {pdasLivres.map((p) => (
                            <option key={p.id} value={p.id}>{p.numero_serie} · {p.modelo}</option>
                          ))}
                        </select>
                        <button className="botao botao-forte" disabled={salvando} onClick={() => confirmarCheckin(l)}>
                          {salvando ? 'Salvando…' : 'Confirmar check-in'}
                        </button>
                        <button className="botao" onClick={() => setEdicao(null)}>Cancelar</button>
                      </div>
                    </td>
                  ) : editando && edicao.modo === 'checkout' ? (
                    <td colSpan={2}>
                      <div className="acao-linha">
                        <span className="pergunta">Devolver {l.pda}?</span>
                        <input
                          className="campo"
                          placeholder="Observação (opcional)"
                          value={edicao.observacao}
                          onChange={(e) => setEdicao({ ...edicao, observacao: e.target.value })}
                          aria-label="Observação da devolução"
                          maxLength={255}
                          autoFocus
                        />
                        <button className="botao botao-forte" disabled={salvando} onClick={() => confirmarCheckout(l)}>
                          {salvando ? 'Salvando…' : 'Confirmar check-out'}
                        </button>
                        <button className="botao" onClick={() => setEdicao(null)}>Cancelar</button>
                      </div>
                    </td>
                  ) : (
                    <>
                      <td>{l.pda || <span className="apagado">—</span>}</td>
                      <td><Situacao linha={l} /></td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {novoAberto && (
        <NovoColaborador
          aoFechar={() => setNovoAberto(false)}
          aoSalvar={async (nome) => {
            setNovoAberto(false)
            setAviso({ tipo: 'ok', texto: `${nome} cadastrado.` })
            await carregar()
          }}
        />
      )}
    </section>
  )
}

function Cartao({ rotulo, valor, tom }) {
  return (
    <div className="cartao-numero">
      <div className="rotulo">{rotulo}</div>
      <div className={`valor ${tom ? `tom-${tom}` : ''}`}>{valor}</div>
    </div>
  )
}

function Situacao({ linha }) {
  if (!linha.com_pda) return <span className="apagado">Sem PDA</span>
  if (linha.situacao === 'aguardando') {
    return <span className="pilula pilula-alerta">Aguardando CPF · {hora(linha.checkin_em)}</span>
  }
  return <span className="pilula pilula-info">Em uso · check-in {hora(linha.checkin_em)}</span>
}
