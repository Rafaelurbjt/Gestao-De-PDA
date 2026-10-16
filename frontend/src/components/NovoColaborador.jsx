/**
 * components/NovoColaborador.jsx
 *
 * Janela (modal) para cadastrar um colaborador: só nome, CPF e empresa.
 * O vínculo (CLT ou diarista) não é digitado: a API define pela empresa.
 *
 * Props (vêm de quem abre a janela, a tela de Cadastros):
 *   aoFechar -> chamada ao cancelar, apertar Esc ou clicar fora da janela
 *   aoSalvar -> chamada depois de cadastrar, com o nome da pessoa
 */

import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatarCpf } from '../utils'

export default function NovoColaborador({ aoFechar, aoSalvar }) {
  // Cada useState guarda uma informação da tela. Os campos do formulário
  // ficam no estado e a tela os mostra: é o que o React chama de campo
  // "controlado" (o valor mostrado sempre vem do estado).
  const [empresas, setEmpresas] = useState([])
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  // O valor de um <select> é sempre texto, por isso o id da empresa fica como texto aqui
  const [empresaId, setEmpresaId] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Roda UMA vez, quando a janela abre (o [] no final significa "sem
  // dependências"): busca a lista de empresas na API para preencher o seletor.
  useEffect(() => {
    api('/empresas')
      .then((lista) => {
        setEmpresas(lista)
        // Já deixa a primeira empresa selecionada
        if (lista[0]) setEmpresaId(String(lista[0].id)) // J&T vem primeiro
      })
      .catch((e) => setErro(e.message))
  }, [])

  // Fecha com Esc. O listener é registrado ao abrir a janela e REMOVIDO ao
  // fechar (a função devolvida no return é a "limpeza"); sem isso, sobrariam
  // ouvintes pendurados na página.
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  async function salvar(e) {
    // Impede o navegador de recarregar a página ao enviar o formulário
    e.preventDefault()
    setErro('')
    // Conferências rápidas no navegador, para dar resposta imediata. A API
    // confere de novo (nunca confie só no navegador). O "return setErro(...)"
    // mostra o erro e interrompe a função.
    if (nome.trim().length < 3) return setErro('Digite o nome completo.')
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Digite os 11 números do CPF.')
    setSalvando(true) // desabilita o botão para evitar dois cliques
    try {
      await api('/colaboradores', {
        metodo: 'POST',
        corpo: { nome: nome.trim(), cpf, empresa_id: Number(empresaId) },
      })
      // Deu certo: avisa quem abriu a janela, que a fecha e atualiza a lista.
      // Não há setSalvando(false) aqui porque a janela some.
      aoSalvar(nome.trim())
    } catch (e) {
      // Traduz a mensagem genérica do banco para uma mais clara
      setErro(e.message === 'Já existe um cadastro com esse valor.' ? 'Esse CPF já está cadastrado.' : e.message)
      setSalvando(false) // libera o botão para tentar de novo
    }
  }

  return (
    // Fundo escurecido. Clicar nele fecha a janela, mas só quando o clique é
    // no fundo mesmo (e.target === e.currentTarget), não dentro do formulário.
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      {/* role, aria-modal e aria-labelledby avisam leitores de tela que é uma
          janela e qual é o título. noValidate desliga as mensagens padrão do
          navegador, porque usamos as nossas. */}
      <form className="modal" onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="titulo-novo" noValidate>
        <h2 id="titulo-novo">Novo colaborador</h2>

        {/* htmlFor liga o texto ao campo: clicar no texto foca o campo */}
        <label htmlFor="novo-nome">Nome completo</label>
        <input id="novo-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />

        <label htmlFor="novo-cpf">CPF</label>
        <input
          id="novo-cpf"
          className="campo"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={cpf}
          // formatarCpf coloca os pontos e o traço enquanto a pessoa digita
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
        />

        <label htmlFor="novo-empresa">Empresa</label>
        <select id="novo-empresa" className="campo" value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}>
          {empresas.map((em) => (
            <option key={em.id} value={em.id}>
              {em.nome} {em.tipo === 'propria' ? '(CLT)' : '(diaristas)'}
            </option>
          ))}
        </select>

        {/* Só aparece se houver erro. role="alert" faz o leitor de tela anunciá-lo. */}
        {erro && <p className="erro" role="alert">{erro}</p>}

        <div className="modal-botoes">
          <button type="button" className="botao" onClick={aoFechar}>Cancelar</button>
          <button type="submit" className="botao botao-forte" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}