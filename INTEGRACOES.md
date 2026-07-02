# Integracoes atuais

## Login/local dev

Credenciais seedadas para desenvolvimento:

```text
admin@vendaora.com / admin123
super@vendaora.com / super123
```

Para SQLite local, o `DATABASE_URL` deve ficar assim porque o caminho e relativo a `prisma/schema.prisma`:

```env
DATABASE_URL="file:./dev.db"
```

## Chatwoot

Status: adapter HTTP funcional.

Entrada:

```text
POST /api/integrations/chatwoot/webhook?tenantId=<TENANT_ID>
```

Segredo opcional:

```env
CHATWOOT_WEBHOOK_SECRET=""
```

Quando configurado, envie um destes headers:

```text
Authorization: Bearer <secret>
x-vendaora-signature: <secret>
x-chatwoot-webhook-secret: <secret>
```

O adapter cria/atualiza:

- `Channel` provider `chatwoot`
- `ChannelInstance`
- `Contact`
- `ContactIdentity`
- `Conversation`
- `Message`

## whatsmeow

Status: sidecar Go criado e compilando.

Node recebe mensagens em:

```text
POST /api/integrations/whatsmeow/incoming?tenantId=<TENANT_ID>
```

Node chama o bridge por:

```env
WHATSMEOW_BRIDGE_URL="http://localhost:4000"
WHATSMEOW_BRIDGE_SECRET=""
```

Bridge envia inbound para o Node por:

```env
WHATSMEOW_WEBHOOK_URL="http://localhost:3333/api/integrations/whatsmeow/incoming?tenantId=seed-tenant"
```

Endpoints do bridge:

```text
GET  /status
GET  /qr
POST /send
POST /logout
```

Rodar:

```bash
cd whatsmeow-bridge
go run .
```

Depois configure `WHATSMEOW_BRIDGE_URL` no `.env` do Node e reinicie `npm run dev`.

## Meta/WhatsApp Cloud API

Status: somente variaveis no `.env.example`; nao ha rota Cloud API implementada ainda.

Variaveis existentes:

```env
META_APP_ID=""
META_APP_SECRET=""
META_VERIFY_TOKEN=""
WHATSAPP_CLOUD_TOKEN=""
WHATSAPP_PHONE_NUMBER_ID=""
```

## WaCalls — Chamadas de Voz WhatsApp

**Status:** Auto-hosteadas. O Node.js gerencia o processo WaCalls Go automaticamente.

### Setup rápido (local dev — sem Docker)

```bash
# Tudo automático - apenas inicie o servidor:
npm run dev

# O Node.js detecta Go, clona, compila e inicia o WaCalls sozinho.
# Nenhuma configuração extra necessária.
```

Se quiser rodar o WaCalls separadamente (para debug):

```bash
.\scripts\setup-wacalls.ps1   # clona + compila
npm run wacalls:start          # inicia o sidecar em :8081
```

### Via Docker

```bash
docker compose up -d
```

O serviço `wacalls` roda como sidecar separado. A aplicação conecta automaticamente em `http://wacalls:8080`.

Para single-container (tudo no mesmo container), descomente o serviço `app-embedded` no `docker-compose.yml`.

### Configuração

```env
# Deixe VAZIO para auto-hosting (recomendado)
# WACALLS_URL=""

# Ou aponte para um servidor externo:
WACALLS_URL="http://localhost:8081"

WACALLS_PORT=8081
WACALLS_DB_PATH="./wacalls/wacalls.db"
```

### API WaCalls (proxy pelo Node)

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/calls/sessions` | Lista sessões WhatsApp para chamadas |
| `POST` | `/api/calls/sessions` | Cria nova sessão (QR pairing) |
| `DELETE` | `/api/calls/sessions/:sid` | Remove sessão |
| `POST` | `/api/calls/sessions/:sid/pair` | Inicia pareamento QR |
| `POST` | `/api/calls/sessions/:sid/logout` | Desconecta sessão |
| `POST` | `/api/calls/sessions/:sid/calls` | Inicia chamada de voz |
| `POST` | `/api/calls/sessions/:sid/calls/:id/webrtc` | Troca SDP WebRTC |
| `POST` | `/api/calls/sessions/:sid/calls/:id/accept` | Aceita chamada recebida |
| `POST` | `/api/calls/sessions/:sid/calls/:id/reject` | Rejeita chamada recebida |
| `DELETE` | `/api/calls/sessions/:sid/calls/:id` | Encerra chamada ativa |
| `GET` | `/api/calls/sessions/:sid/history` | Histórico de chamadas |

### Eventos em tempo real (Socket.IO)

O Node faz bridge dos eventos SSE do WaCalls para Socket.IO:

| Evento | Descrição |
|--------|-----------|
| `wacalls:incoming` | Chamada recebida |
| `wacalls:status` | Mudança de status da chamada |
| `wacalls:ended` | Chamada encerrada |
| `wacalls:list` | Lista de chamadas ativas |
| `wacalls:sessions` | Lista de sessões atualizada |
| `wacalls:qr` | QR code para pareamento |
| `wacalls:auth` | Estado de autenticação |

### Arquitetura

```
WhatsApp Relay ←→ WaCalls (Go sidecar :8081)
                         ↓ SSE events
                   WaCallsSSEBridge (Node)
                         ↓ Socket.IO
                   Frontend React (Chamadas)
                         ↓ HTTP proxy
                   Express /api/calls/* → WaCalls API
```

### Dependências

- **Go 1.26+** (para compilar o WaCalls)
- Porta `8081` (pode ser alterada via `-addr`)

## Status geral

```text
GET /api/integrations/status?tenantId=<TENANT_ID>
GET /api/calls/bridge/status  (status do sidecar WaCalls)
```
