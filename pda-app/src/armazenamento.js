/**
 * Guarda a configuração do aparelho no próprio PDA:
 *   { servidor, token, numeroSerie }
 *   servidor    -> endereço da API (ex.: http://172.16.50.182:3000)
 *   token       -> token do aparelho, entregue pela API ao cadastrar o PDA
 *   numeroSerie -> identifica qual PDA é este
 *
 * Exporta: lerConfig, salvarConfig, apagarConfig
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Guarda a configuração do aparelho de forma protegida no próprio PDA.
// (No navegador, usado só para testes, cai no localStorage.)
// SecureStore usa o cofre do Android (Keystore): os dados ficam criptografados
// e fora do alcance de outros apps. O token do aparelho é o "crachá" dele,
// por isso não fica em armazenamento comum.
const CHAVE = 'config_pda'
const web = Platform.OS === 'web'; // true só quando o app roda no navegador (testes)

// Lê a configuração. Devolve o objeto ou null se o aparelho ainda não foi configurado.
// O armazenamento só guarda texto, por isso o JSON.parse converte de volta em objeto.
export async function lerConfig() {
  const texto = web ? localStorage.getItem(CHAVE) : await SecureStore.getItemAsync(CHAVE);
  return texto ? JSON.parse(texto) : null; // { servidor, token, numeroSerie }
}

// Salva a configuração (objeto -> texto com JSON.stringify)
export async function salvarConfig(config) {
  const texto = JSON.stringify(config);
  if (web) localStorage.setItem(CHAVE, texto);
  else await SecureStore.setItemAsync(CHAVE, texto);
}

// Apaga a configuração, voltando o aparelho para a tela de configuração inicial
export async function apagarConfig() {
  if (web) localStorage.removeItem(CHAVE);
  else await SecureStore.deleteItemAsync(CHAVE);
}