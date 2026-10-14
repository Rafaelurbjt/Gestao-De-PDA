import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Durante o desenvolvimento, o Vite roda na porta 5173 e a API na 3000.
// O proxy repassa as chamadas da API para a porta 3000, então o código
// pode usar caminhos como "/auth/login" sem se preocupar com o endereço.
const API = 'http://127.0.0.1:3000'
const rotasDaApi = ['/auth', '/empresas', '/colaboradores', '/pdas', '/checkins', '/dispositivo', '/health']

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(rotasDaApi.map((rota) => [rota, API])),
  },
})
