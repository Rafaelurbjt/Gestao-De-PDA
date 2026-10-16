/**
 * pages/CheckinCheckout.jsx
 *
 * A tela principal do balcão (aba "Check-in / check-out"). Mostra:
 *   - cartões com a contagem de PDAs (livres, aguardando CPF, em uso, bloqueados)
 *   - busca por nome ou CPF e filtro por empresa
 *   - a lista de colaboradores com um checkbox: marcar = entregar um PDA
 *     (check-in); desmarcar = receber o PDA de volta (check-out)
 *
 * O checkbox não age na hora: ele abre uma confirmação dentro da própria
 * linha (escolher o PDA, ou digitar uma observação) para evitar cliques por engano.
 *
 * A tela se atualiza sozinha a cada 5 s, para o líder ver quando o colaborador
 * confirma o CPF no PDA.
 *
 * Rotas usadas: GET /checkins/painel, GET /pdas, POST /checkins,
 * POST /checkins/:id/checkout (ver routes/checkins.js e routes/pdas.js).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { mascararCpf } from '../utils'
import NovoColaborador from '../components/NovoColaborador'

// De quanto em quanto tempo a tela busca dados novos (5000 ms = 5 s)
const ATUALIZAR_A_CADA_MS = 5000

// "2026-10-14T10:02:00Z" -> "07:02" (ou "13/10 07:02" se não for hoje)
// A API manda a hora em UTC; o toLocaleTimeString converte para o fuso do computador.
function hora(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  // Compara só o dia (toDateString ignora a hora) para saber se é hoje
  const hoje = new Date().toDateString() === d.toDateString()
  return hoje ? hhmm : `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${hhmm}`
}

export default function CheckinCheckout() {
  // Dados vindos da API
  const [painel, setPainel] = useState([]) // colaboradores e quem está com PDA
  const [pdas, setPdas] = useState([])
  const [carregando, setCarregando] = useState(true) // só true até a 1ª resposta
  const [erroCarga, setErroCarga] = useState('')
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'erro', texto }

  // Filtros digitados pelo líder
  const [busca, setBusca] = useState('')
  const [empresa, setEmpresa] = useState('')

  // Linha em edição: { colaboradorId, modo: 'checkin' | 'checkout', pdaId, observacao }
  // É null quando nenhuma linha está aberta para confirmação.
  const [edicao, setEdicao] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [novoAberto, setNovoAberto] = useState(false)

  // Busca painel e PDAs. O Promise.all dispara as duas chamadas ao mesmo tempo
  // e espera as duas terminarem (mais rápido que uma depois da outra).
  // O "finally" roda sempre, com sucesso ou erro, e tira a mensagem "Carregando".
  // useCallback mantém a mesma função entre redesenhos (ver Cadastros.jsx).
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
  // O return desliga o relógio quando a tela fecha (troca de aba); sem isso, ele
  // continuaria consultando a API em segundo plano.
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

  // useMemo guarda o resultado de um cálculo e só o refaz quando o que está
  // entre colchetes muda. Aqui: conta quantos PDAs há em cada situação.
  // A condição "!== undefined" ignora situações que não têm cartão (manutenção).
  const contagem = useMemo(() => {
    const c = { livre: 0, reservado: 0, em_uso: 0, bloqueado: 0 }
    pdas.forEach((p) => { if (c[p.status] !== undefined) c[p.status]++ })
    return c
  }, [pdas])

  // Só os PDAs livres entram na lista de escolha do check-in
  const pdasLivres = useMemo(() => pdas.filter((p) => p.status === 'livre'), [pdas])

  // Nomes de empresa para o filtro: o Set remove repetidos, o sort ordena
  const empresas = useMemo(() => [...new Set(painel.map((l) => l.empresa))].sort(), [painel])

  // Aplica os dois filtros à lista. A busca procura no nome (em qualquer lugar)
  // ou no começo do CPF; o "digitos &&" evita que um nome sem números case com todos os CPFs.
  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const digitos = busca.replace(/\D/g, '')
    return painel.filter((l) => {
      if (empresa && l.empresa !== empresa) return false
      if (!termo) return true
      return l.nome.toLowerCase().includes(termo) || (digitos && l.cpf.startsWith(digitos))
    })
  }, [painel, busca, empresa])

  // Clique no checkbox: não grava nada, só abre a confirmação na linha.
  // Quem já tem PDA vai para o check-out; quem não tem, para o check-in.
  function clicarCheckbox(linha) {
    if (salvando) return
    if (linha.com_pda) {
      setEdicao({ colaboradorId: linha.colaborador_id, modo: 'checkout', observacao: '' })
    } else {
      setEdicao({ colaboradorId: linha.colaborador_id, modo: 'checkin', pdaId: '' })
    }
  }

  async function confirmarCheckin(linha) {
    // O return interrompe a função: sem PDA escolhido, nem chama a API
    if (!edicao.pdaId) return setAviso({ tipo: 'erro', texto: 'Escolha um PDA livre.' })
    setSalvando(true)
    try {
      const r = await api('/checkins', {
        metodo: 'POST',
        corpo: { colaborador_id: linha.colaborador_id, pda_id: Number(edicao.pdaId) },
      })
      await carregar()
      setEdicao(null) // fecha a confirmação
      setAviso({ tipo: 'ok', texto: `${r.pda} entregue para ${r.colaborador}. Aguardando o CPF no aparelho.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
      // Recarrega também no erro: se o PDA foi pego por outro líder, a lista se corrige
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

  // Este "return antecipado" fica DEPOIS de todos os hooks (useState, useEffect,
  // useMemo...). Regra do React: hooks nunca podem ficar dentro de um if nem
  // depois de um return condicional.
  if (carregando) return <p className="carregando">Carregando…</p>

  return (
    <section>
      {/* Cartões de resumo, no topo */}
      <div className="resumo">
        <Cartao rotulo="Livres" valor={contagem.livre} />
        <Cartao rotulo="Aguardando CPF" valor={contagem.reservado} tom="alerta" />
        <Cartao rotulo="Em uso" valor={contagem.em_uso} tom="info" />
        <Cartao rotulo="Bloqueados" valor={contagem.bloqueado} tom="perigo" />
      </div>

      {erroCarga && <p className="erro" role="alert">{erroCarga}</p>}
      {aviso && <p className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</p>}

      {/* Busca, filtro de empresa e botão de novo colaborador */}
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
            {/* Lista vazia: a mensagem muda se não há ninguém cadastrado ou se o filtro não achou */}
            {linhas.length === 0 && (
              <tr><td colSpan={5} className="vazio-linha">
                {painel.length === 0 ? 'Nenhum colaborador cadastrado ainda. Use "+ Novo colaborador".' : 'Ninguém encontrado com esse filtro.'}
              </td></tr>
            )}
            {linhas.map((l) => {
              // "?." evita erro quando edicao é null; a linha só está em edição
              // se o id dela for o da edição aberta
              const editando = edicao?.colaboradorId === l.colaborador_id
              return (
                <tr key={l.colaborador_id} className={editando ? 'editando' : ''}>
                  <td className="col-check">
                    {/* Checkbox controlado: durante a edição, mostra o que o líder
                        está prestes a fazer (marcado = check-in); fora dela, mostra
                        a situação real (com PDA ou não). */}
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

                  {/* As duas últimas colunas têm 3 versões: confirmação de
                      check-in, confirmação de check-out, ou a situação normal. */}
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
                    // <> ... </> é um "fragmento": agrupa os dois <td> sem criar elemento extra
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

      {/* Janela de novo colaborador; ao salvar, recarrega a lista */}
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

// Cartão de número do topo (ex.: "Livres 12"). "tom" muda a cor do número.
function Cartao({ rotulo, valor, tom }) {
  return (
    <div className="cartao-numero">
      <div className="rotulo">{rotulo}</div>
      <div className={`valor ${tom ? `tom-${tom}` : ''}`}>{valor}</div>
    </div>
  )
}

// Texto da coluna "Situação": sem PDA, aguardando o CPF, ou em uso, com a hora do check-in
function Situacao({ linha }) {
  if (!linha.com_pda) return <span className="apagado">Sem PDA</span>
  if (linha.situacao === 'aguardando') {
    return <span className="pilula pilula-alerta">Aguardando CPF · {hora(linha.checkin_em)}</span>
  }
  return <span className="pilula pilula-info">Em uso · check-in {hora(linha.checkin_em)}</span>
}