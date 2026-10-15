import { StyleSheet } from 'react-native';

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

export const estilo = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, paddingTop: 48, paddingHorizontal: 24 },
  marca: { fontSize: 15, fontWeight: '700', color: cores.vermelho, letterSpacing: 0.5 },
  serie: { fontSize: 13, color: cores.texto2, marginTop: 2 },
  centro: { flex: 1, justifyContent: 'center' },
  titulo: { fontSize: 26, fontWeight: '700', color: cores.tinta, textAlign: 'center' },
  sub: { fontSize: 16, color: cores.texto2, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  rotulo: { fontSize: 14, fontWeight: '600', color: cores.tinta, marginBottom: 6, marginTop: 14 },
  campo: {
    height: 52, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.linha,
    borderRadius: 10, paddingHorizontal: 14, fontSize: 18, color: cores.tinta,
  },
  campoCpf: { height: 64, fontSize: 28, textAlign: 'center', letterSpacing: 1, marginTop: 24 },
  botao: {
    height: 56, borderRadius: 10, backgroundColor: cores.vermelho,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  botaoTexto: { color: '#fff', fontSize: 18, fontWeight: '700' },
  botaoSecundario: {
    height: 48, borderRadius: 10, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.cartao,
    alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  botaoSecundarioTexto: { color: cores.tinta, fontSize: 16, fontWeight: '600' },
  erro: {
    backgroundColor: cores.erroClaro, color: cores.vermelhoEscuro, borderRadius: 10,
    padding: 12, fontSize: 15, marginTop: 14, textAlign: 'center',
  },
  icone: { fontSize: 56, textAlign: 'center', marginBottom: 12 },
  dica: { fontSize: 13, color: cores.texto2, marginBottom: 6, marginTop: -2 },
  sobreposicao: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(20,22,26,0.55)', justifyContent: 'center', padding: 24,
  },
  caixa: { backgroundColor: cores.cartao, borderRadius: 14, padding: 20 },
});