/**
 * main.jsx
 *
 * Ponto de entrada do balcão: o primeiro arquivo JavaScript que roda.
 * Ele pega a <div id="root"> do index.html e desenha o <App /> dentro dela.
 * A partir daí, o React cuida de tudo.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Importar o CSS aqui faz o Vite incluí-lo em todas as telas
import './index.css'
import App from './App.jsx'

// document.getElementById('root') acha a <div id="root"> do index.html.
// createRoot prepara essa div para o React; render() desenha o App nela.
createRoot(document.getElementById('root')).render(
  // StrictMode só atua em desenvolvimento (npm run dev): ele roda alguns
  // efeitos duas vezes de propósito, para revelar bugs como timers sem
  // limpeza. Não aparece nem tem custo na versão final (npm run build).
  <StrictMode>
    <App />
  </StrictMode>,
)