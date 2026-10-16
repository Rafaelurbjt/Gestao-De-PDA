/**
 * Estilos e cores do app do PDA (equivalente ao index.css do balcão).
 *
 * No React Native não existe CSS: os estilos são objetos JavaScript, com os
 * nomes em camelCase (backgroundColor, não background-color) e números sem
 * "px". Cada tela usa assim: <View style={estilo.tela}>.
 * Quase todo layout aqui é flexbox, como no balcão.
 */

import { StyleSheet } from 'react-native';

// Paleta do app (mesmas cores do balcão). Mude aqui e o app inteiro acompanha.
export const cores = {
  vermelho: '#D5121E',
  vermelhoEscuro: '#A80E17',
  tinta: '#1C1F25',
  texto2: '#5A606B',
  fundo: '#F4F4F5',
  cartao: '#FFFFFF',
  linha: '#E2E2E5',
  verde: '#1B7A3E',
  verdeClaro: '#E8F5EC',
  erroClaro: '#FDECEC',
};

// StyleSheet.create reúne todos os estilos em um objeto, validando os nomes das propriedades.
export const estilo = StyleSheet.create({
  // Tela inteira: flex: 1 ocupa todo o espaço; paddingTop deixa espaço para a barra de status do Android
  tela: { flex: 1, backgroundColor: cores.fundo, paddingTop: 48, paddingHorizontal: 24 },
  // Cabeçalho: nome do sistema e número de série do PDA
  marca: { fontSize: 15, fontWeight: '700', color: cores.vermelho, letterSpacing: 0.5 },
  serie: { fontSize: 13, color: cores.texto2, marginTop: 2 },
  // Centraliza o conteúdo na vertical (a tela é uma coluna por padrão no React Native)
  centro: { flex: 1, justifyContent: 'center' },
  // Textos grandes centralizados (título e subtítulo das telas)
  titulo: { fontSize: 26, fontWeight: '700', color: cores.tinta, textAlign: 'center' },
  sub: { fontSize: 16, color: cores.texto2, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  // Rótulo de campo (config) e o próprio campo de texto
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.tinta, marginBottom: 6, marginTop: 14 },
  campo: {
    height: 52, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.linha,
    borderRadius: 10, paddingHorizontal: 14, fontSize: 18, color: cores.tinta,
  },
  // Variação do campo, grande, para digitar o CPF com o dedo
  campoCpf: { height: 64, fontSize: 28, textAlign: 'center', letterSpacing: 1, marginTop: 24 },
  // Botão principal vermelho (View que recebe o toque). O texto fica no botaoTexto.
  botao: {
    height: 56, borderRadius: 10, backgroundColor: cores.vermelho,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  botaoTexto: { color: '#fff', fontSize: 18, fontWeight: '700' },
  // Botão claro com borda, para ações secundárias
  botaoSecundario: {
    height: 48, borderRadius: 10, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.cartao,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  botaoSecundarioTexto: { color: cores.tinta, fontSize: 16, fontWeight: '600' },
  // Caixa de erro (ex.: CPF não confere, sem conexão)
  erro: {
    backgroundColor: cores.erroClaro, color: cores.vermelhoEscuro, borderRadius: 10,
    padding: 12, fontSize: 15, marginTop: 14, textAlign: 'center',
  },
  // Emoji/ícone grande no topo das telas de status; dica = texto pequeno de apoio
  icone: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  dica: { fontSize: 13, color: cores.texto2, marginBottom: 6, marginTop: -2 },
  // Fundo escuro que cobre a tela inteira (position: absolute + 4 bordas em 0), usado atrás da janela de PIN
  sobreposicao: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(20,22,26,0.55)', justifyContent: 'center', padding: 24,
  },
  // A janela branca que fica sobre a sobreposição
  caixa: { backgroundColor: cores.cartao, borderRadius: 14, padding: 20 },
});