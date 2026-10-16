# Controle de PDAs

Sistema interno para controlar quem está com cada PDA (aparelho de bipagem) na operação.
O colaborador (diarista ou CLT) só usa o PDA depois que o líder entrega o aparelho no balcão
**e** o próprio colaborador confirma o CPF no aparelho. Tudo fica registrado.

Tudo roda na rede local da unidade, sem depender de internet.

## Como funciona

1. **Check-in (balcão):** o líder escolhe o colaborador e um PDA livre. O PDA fica *reservado*.
2. **Confirmação (PDA):** o PDA mostra o campo de CPF. O colaborador digita o CPF; se for o do check-in, o PDA passa para *em uso* e mostra "Acesso liberado".
3. **Check-out:** o líder (no balcão) ou o colaborador (no PDA) devolve o aparelho, que volta a *livre*.

Um PDA só pode estar com uma pessoa por vez, e uma pessoa só pode estar com um PDA por vez
(garantido pelo banco, não só pelo código).

## Partes do sistema

| Pasta | O que é | Tecnologia |
|---|---|---|
| `api-pda/` | API (regras de negócio) | Node.js 18+, Express 5, MySQL 8 |
| `frontend/` | Site do balcão (líderes) | React + Vite |
| `pda-app/` | App do PDA (colaboradores) | React Native + Expo |

```
 Computador do balcão          Servidor (rede local)            PDA (Android)
┌──────────────────┐  HTTP   ┌───────────────────────┐  HTTP   ┌──────────────┐
│ frontend (React) │ ──────► │ api-pda (Express)     │ ◄────── │ pda-app      │
│ login: CPF+senha │         │        │              │         │ CPF do colab.│
└──────────────────┘         │     MySQL 8           │         └──────────────┘
                             └───────────────────────┘
```

## Situações

- **PDA:** `livre` → `reservado` → `em_uso` → `livre` (e também `bloqueado` e `manutencao`, definidos pelo balcão).
- **Check-in:** `aguardando` → `em_uso` → `finalizado` (ou `cancelado`).

## Como rodar (desenvolvimento)

Requisitos: Node.js 18 ou superior e MySQL 8.

```bash
# 1. API
cd api-pda
npm install          # no servidor, use: npm ci
# crie o arquivo .env (veja abaixo)
npm run dev          # ou: node src/server.js   (porta 3000)

# 2. Criar o primeiro líder (uma vez)
npm run criar-lider  # ou: node src/criar-lider.js

# 3. Site do balcão
cd ../frontend
npm install
npm run dev          # abre em http://localhost:5173
```

No Windows, o `iniciar.bat` sobe o MySQL, a API e o site de uma vez e abre o navegador.

### Variáveis do `.env` (pasta `api-pda`)

| Variável | Para que serve |
|---|---|
| `PORT` | porta da API (padrão 3000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | conexão com o MySQL |
| `JWT_SECRET` | segredo que assina o login dos líderes (use um valor longo e único) |
| `JWT_EXPIRA` | validade do login (ex.: `12h`) |

**Nunca** coloque o `.env` no Git nem em e-mail/chat.

### App do PDA (`pda-app`)

```bash
cd pda-app
npm install
npx expo start                       # testar no Expo Go
eas build -p android --profile preview   # gerar o APK
```

Na primeira abertura, o app pede: endereço da API (ex.: `http://IP-DO-SERVIDOR:3000`),
CPF e senha de um líder, número de série do PDA e uma senha de administrador do aparelho
(para reabrir a configuração depois). A configuração fica guardada no cofre do Android.
Para abrir a configuração de novo: 5 toques rápidos em "CONTROLE DE PDAs" e digitar a senha.

> O app usa HTTP (sem HTTPS) dentro da rede local. Isso está liberado em `app.json`
> (`usesCleartextTraffic`). Se a API passar a usar HTTPS, remova essa opção.

## Rotas da API

Todas, exceto `/health`, `/auth/login` e as do PDA, exigem login de líder (`Authorization: Bearer <token>`).
As rotas do PDA usam o token do aparelho (`x-dispositivo-token`).

| Rota | O que faz |
|---|---|
| `GET /health` | confere se a API e o banco estão no ar |
| `POST /auth/login` | login do líder (CPF + senha) |
| `GET /empresas`, `POST /empresas` | empresas (CLT e terceirizadas) |
| `GET /colaboradores?busca=`, `POST /colaboradores`, `PATCH /colaboradores/:id/desativar` | colaboradores |
| `GET /pdas`, `POST /pdas`, `PATCH /pdas/:id/status` | PDAs (cadastro, bloqueio, manutenção, liberar) |
| `GET /checkins/painel`, `POST /checkins`, `POST /checkins/:id/checkout`, `GET /checkins/historico` | entrega e devolução; painel e histórico |
| `POST /dispositivo/registrar` | cadastra o aparelho e devolve o token dele (líder) |
| `GET /dispositivo/status`, `POST /dispositivo/confirmar`, `POST /dispositivo/encerrar` | usadas pelo PDA |

## Segurança

- Senhas dos líderes guardadas com **bcrypt** (nunca em texto).
- Login dos líderes com **JWT** de validade limitada.
- Token do aparelho guardado no banco só como hash (**SHA-256**); o valor original existe apenas no PDA.
- CPF aparece mascarado nas listas do balcão.
- O CPF digitado errado no PDA é contado; o histórico guarda tudo (nada é apagado, colaboradores são *desativados*).

## Estrutura das pastas

```
api-pda/
  src/
    server.js            # liga as rotas e inicia a API
    db.js                # conexão com o MySQL e transações
    criar-lider.js       # cria um líder pelo terminal
    middlewares/         # auth.js (líder) e dispositivo.js (PDA)
    routes/              # auth, empresas, colaboradores, pdas, checkins, dispositivo
frontend/
  index.html
  src/
    main.jsx  App.jsx  api.js  utils.js  index.css
    pages/               # Login, CheckinCheckout, Pdas, Cadastros, Historico
    components/          # Layout, NovoColaborador, Status
pda-app/
  index.js  App.js  app.json
  src/                   # api.js, armazenamento.js, estilo.js, TelaConfiguracao.js, TelaPda.js
```

## Para colocar em produção (servidor)

- Instalar Node.js 18+ e MySQL 8 no servidor; usar `npm ci`.
- Rodar a API como serviço (reinicia sozinha após queda ou reinício do servidor).
- IP **fixo** para o servidor e liberação da porta 3000 de entrada no firewall (pedido à T.I.).
- Rede Wi-Fi dos PDAs com acesso ao servidor e **sem isolamento de clientes**.
- Backup diário do banco MySQL.
- Gerar o site do balcão com `npm run build` e servi-lo pelo próprio servidor.
