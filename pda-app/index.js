// index.js (raiz do pda-app)
// Primeiro arquivo que o Android executa. É o equivalente ao main.jsx do balcão.
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent registra o App como o componente principal do aplicativo
// (por baixo, chama AppRegistry.registerComponent('main', () => App)).
// Funciona igual no Expo Go (testes) e no APK gerado, e já prepara o ambiente.
registerRootComponent(App);