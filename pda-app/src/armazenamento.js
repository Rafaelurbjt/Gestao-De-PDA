import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Guarda a configuração do aparelho de forma protegida no próprio PDA.
// (No navegador, usado só para testes, cai no localStorage.)
const CHAVE = 'config_pda';
const web = Platform.OS === 'web';

export async function lerConfig() {
  const texto = web ? localStorage.getItem(CHAVE) : await SecureStore.getItemAsync(CHAVE);
  return texto ? JSON.parse(texto) : null; // { servidor, token, numeroSerie }
}

export async function salvarConfig(config) {
  const texto = JSON.stringify(config);
  if (web) localStorage.setItem(CHAVE, texto);
  else await SecureStore.setItemAsync(CHAVE, texto);
}

export async function apagarConfig() {
  if (web) localStorage.removeItem(CHAVE);
  else await SecureStore.deleteItemAsync(CHAVE);
}