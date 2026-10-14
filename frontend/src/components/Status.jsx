// Pílula colorida com a situação do PDA (usada em mais de uma tela)
const ROTULOS = {
  livre: ['Livre', 'pilula-ok'],
  reservado: ['Aguardando CPF', 'pilula-alerta'],
  em_uso: ['Em uso', 'pilula-info'],
  bloqueado: ['Bloqueado', 'pilula-perigo'],
  manutencao: ['Manutenção', 'pilula-neutra'],
  // situações de um check-in (histórico)
  aguardando: ['Aguardando CPF', 'pilula-alerta'],
  finalizado: ['Finalizado', 'pilula-ok'],
  cancelado: ['Cancelado', 'pilula-neutra'],
}

export default function Status({ valor }) {
  const [texto, classe] = ROTULOS[valor] || [valor, 'pilula-neutra']
  return <span className={`pilula ${classe}`}>{texto}</span>
}