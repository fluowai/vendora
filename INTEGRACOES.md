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

## Status geral

```text
GET /api/integrations/status?tenantId=<TENANT_ID>
```
