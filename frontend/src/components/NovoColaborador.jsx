import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatarCpf } from '../utils'

// Janela para cadastrar colaborador: só nome, CPF e empresa.
// O vínculo (CLT ou diarista) a API define pela empresa.
export default function NovoColaborador({ aoFechar, aoSalvar }) {
  const [empresas, setEmpresas] = useState([])
  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    api('/empresas')
      .then((lista) => {
        setEmpresas(lista)
        if (lista[0]) setEmpresaId(String(lista[0].id)) // J&T vem primeiro
      })
      .catch((e) => setErro(e.message))
  }, [])

  // Fecha com Esc
  useEffect(() => {
    const tecla = (e) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  async function salvar(e) {
    e.preventDefault()
    setErro('')
    if (nome.trim().length < 3) return setErro('Digite o nome completo.')
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Digite os 11 números do CPF.')
    setSalvando(true)
    try {
      await api('/colaboradores', {
        metodo: 'POST',
        corpo: { nome: nome.trim(), cpf, empresa_id: Number(empresaId) },
      })
      aoSalvar(nome.trim())
    } catch (e) {
      setErro(e.message === 'Já existe um cadastro com esse valor.' ? 'Esse CPF já está cadastrado.' : e.message)
      setSalvando(false)
    }
  }

  return (
    <div className="fundo-modal" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <form className="modal" onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="titulo-novo" noValidate>
        <h2 id="titulo-novo">Novo colaborador</h2>

        <label htmlFor="novo-nome">Nome completo</label>
        <input id="novo-nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />

        <label htmlFor="novo-cpf">CPF</label>
        <input
          id="novo-cpf"
          className="campo"
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={cpf}
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
