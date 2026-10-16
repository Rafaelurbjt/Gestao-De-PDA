/**
 * pages/Pdas.jsx
 *
 * Aba "PDAs" do balcão. Aqui o líder:
 *   - cadastra um PDA novo (número de série + modelo)
 *   - vê todos os PDAs, com a situação e quem está com cada um
 *   - bloqueia, manda para manutenção ou libera um PDA
 *
 * Fala com a API nestas rotas (ver routes/pdas.js):
 *   GET /pdas   POST /pdas   PATCH /pdas/:id/status
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import Status from '../components/Status'

export default function Pdas() {
  // Estado = a memória da tela. Quando um deles muda, a tela é redesenhada.
  const [pdas, setPdas] = useState([])
  const [carregando, setCarregando] = useState(true) // true só na primeira carga
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'erro', texto } ou null
  // Os dois campos do formulário de cadastro (inputs controlados)
  const [numeroSerie, setNumeroSerie] = useState('')
  const [modelo, setModelo] = useState('')
  const [confirmar, setConfirmar] = useState(null) // { pda, status }
  const [salvando, setSalvando] = useState(false) // desabilita botões durante uma chamada

  // Busca a lista de PDAs na API. useCallback mantém a mesma função entre
  // redesenhos, para poder entrar nas dependências do useEffect abaixo
  // sem fazer o efeito rodar de novo toda hora.
  const carregar = useCallback(async () => {
    try {
      setPdas(await api('/pdas'))
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      // Depois da primeira tentativa (com ou sem erro), sai do "Carregando…"
      setCarregando(false)
    }
  }, [])

  // Carrega ao abrir a aba e depois atualiza sozinho a cada 5 segundos
  // (assim o balcão vê um PDA mudar de "reservado" para "em uso").
  // A função devolvida é a limpeza: ao sair da aba, o relógio é desligado.
  useEffect(() => {
    carregar()
    const t = setInterval(carregar, 5000)
    return () => clearInterval(t)
  }, [carregar])

  // Some com o aviso sozinho depois de 4 segundos. Se um aviso novo chegar
  // antes, o relógio antigo é cancelado e recomeça.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  // Modelos já usados viram sugestão no campo "Modelo"
  // Set remove os repetidos; useMemo só refaz a conta quando "pdas" muda.
  const modelos = useMemo(() => [...new Set(pdas.map((p) => p.modelo))].sort(), [pdas])

  // Cadastra um PDA novo
  async function cadastrar(e) {
    e.preventDefault() // impede o navegador de recarregar a página
    if (!numeroSerie.trim()) return setAviso({ tipo: 'erro', texto: 'Digite o número de série.' })
    if (!modelo.trim()) return setAviso({ tipo: 'erro', texto: 'Digite o modelo.' })
    setSalvando(true)
    try {
      const r = await api('/pdas', { metodo: 'POST', corpo: { numero_serie: numeroSerie, modelo } })
      setNumeroSerie('') // limpa só o número de série; o modelo fica, pois costuma se repetir
      await carregar() // atualiza a tabela
      setAviso({ tipo: 'ok', texto: `${r.numero_serie} cadastrado.` })
    } catch (e) {
      // A API responde essa frase quando o número de série já existe (UNIQUE no banco)
      setAviso({ tipo: 'erro', texto: e.message === 'Já existe um cadastro com esse valor.' ? 'Esse número de série já está cadastrado.' : e.message })
    } finally {
      setSalvando(false) // roda sempre: libera os botões, com sucesso ou erro
    }
  }

  // Muda a situação de um PDA: 'bloqueado', 'manutencao' ou 'livre'.
  // A API cuida de encerrar o uso, se alguém estiver com o aparelho.
  async function mudarStatus(pda, status) {
    setSalvando(true)
    try {
      await api(`/pdas/${pda.id}/status`, { metodo: 'PATCH', corpo: { status } })
      setConfirmar(null) // fecha o "Confirmar / Cancelar", se estava aberto
      await carregar()
      // Traduz o código do status para a frase do aviso
      const textos = { bloqueado: 'bloqueado', manutencao: 'enviado para manutenção', livre: 'liberado' }
      setAviso({ tipo: 'ok', texto: `${pda.numero_serie} ${textos[status]}.` })
    } catch (e) {
      setAviso({ tipo: 'erro', texto: e.message })
    } finally {
      setSalvando(false)
    }
  }

  // Bloquear ou mandar para manutenção um PDA com alguém pede confirmação
  // Sem ninguém com o aparelho, muda direto; com alguém, guarda o pedido em
  // "confirmar" e a linha mostra o aviso com Confirmar / Cancelar.
  function pedir(pda, status) {
    if (pda.colaborador) setConfirmar({ pda, status })
    else mudarStatus(pda, status)
  }

  // Enquanto a primeira carga não termina, mostra só o texto
  if (carregando) return <p className="carregando">Carregando…</p>

  return (
    <section>
      {/* Formulário de cadastro. Enter dentro dos campos também envia. */}
      <form className="painel-form" onSubmit={cadastrar}>
        <h2>Cadastrar PDA</h2>
        <div className="linha-form">
          {/* toUpperCase: o número de série fica sempre em maiúsculas */}
          <input className="campo" placeholder="Número de série (ex.: CT48-0012)" value={numeroSerie}
            onChange={(e) => setNumeroSerie(e.target.value.toUpperCase())} aria-label="Número de série" />
          {/* list="lista-modelos" liga o campo ao datalist abaixo: o navegador sugere os modelos já cadastrados */}
          <input className="campo" placeholder="Modelo (ex.: Urovo CT48)" value={modelo} list="lista-modelos"
            onChange={(e) => setModelo(e.target.value)} aria-label="Modelo" />
          <datalist id="lista-modelos">{modelos.map((m) => <option key={m} value={m} />)}</datalist>
          <button className="botao botao-forte" disabled={salvando}>Cadastrar</button>
        </div>
      </form>

      {/* "cond && <algo/>" só mostra o aviso quando ele existe. role="status" faz leitores de tela anunciá-lo. */}
      {aviso && <p className={`aviso aviso-${aviso.tipo}`} role="status">{aviso.texto}</p>}

      <div className="tabela-caixa">
        <table className="tabela">
          <thead>
            <tr><th>Número de série</th><th>Modelo</th><th>Situação</th><th>Com quem</th><th className="col-acoes">Ações</th></tr>
          </thead>
          <tbody>
            {/* Lista vazia: mostra uma linha avisando, ocupando as 5 colunas */}
            {pdas.length === 0 && <tr><td colSpan={5} className="vazio-linha">Nenhum PDA cadastrado ainda.</td></tr>}
            {/* key ajuda o React a saber qual linha é qual quando a lista muda.
                "confirmar?.pda.id": o ?. evita erro quando confirmar é null. */}
            {pdas.map((p) => (
              <tr key={p.id} className={confirmar?.pda.id === p.id ? 'editando' : ''}>
                <td className="nome">{p.numero_serie}</td>
                <td>{p.modelo}</td>
                {/* Status desenha a etiqueta colorida (livre, em uso, etc.) */}
                <td><Status valor={p.status} /></td>
                <td>{p.colaborador || <span className="apagado">—</span>}</td>
                <td className="col-acoes">
                  {/* Três estados possíveis para a coluna de ações:
                      1) esta linha pediu confirmação -> Confirmar / Cancelar
                      2) PDA bloqueado ou em manutenção -> botão Liberar
                      3) qualquer outro -> botões Bloquear e Manutenção */}
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