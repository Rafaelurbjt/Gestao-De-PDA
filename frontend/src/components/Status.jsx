/**
 * components/Status.jsx
 *
 * Etiqueta colorida (a "pílula") que mostra a situação de um PDA ou de um
 * check-in. É usada em mais de uma tela, então o texto e a cor de cada
 * situação ficam definidos uma única vez, aqui.
 *
 * Uso:  <Status valor="em_uso" />   ->  pílula azul escrita "Em uso"
 *
 * Os valores vêm do banco como estão (livre, em_uso, finalizado...); este
 * componente os traduz para um texto amigável e uma cor.
 */

// Tabela de tradução: valor do banco -> [texto mostrado, classe CSS da cor].
// As classes (pilula-ok, pilula-alerta...) estão no index.css.
const ROTULOS = {
  // situações do PDA
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

// "valor" é a situação vinda da API. Para criar uma situação nova, acrescente
// uma linha em ROTULOS; o componente em si não precisa mudar.
export default function Status({ valor }) {
  // Procura o valor na tabela. Se não achar (situação desconhecida), o "||"
  // usa uma alternativa: mostra o próprio valor, em cinza, em vez de quebrar.
  // O [texto, classe] separa os dois itens da lista de uma vez (desestruturação).
  const [texto, classe] = ROTULOS[valor] || [valor, 'pilula-neutra']
  return <span className={`pilula ${classe}`}>{texto}</span>
}