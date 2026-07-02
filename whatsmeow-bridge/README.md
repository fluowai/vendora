# Vendaora whatsmeow Bridge

Sidecar Go para conectar WhatsApp via `go.mau.fi/whatsmeow` sem misturar o core Node/React.

## Variaveis

```env
PORT=4000
WHATSMEOW_DB_PATH="file:whatsmeow.db?_pragma=foreign_keys(1)"
WHATSMEOW_BRIDGE_SECRET=""
WHATSMEOW_WEBHOOK_URL="http://localhost:3333/api/integrations/whatsmeow/incoming?tenantId=seed-tenant"
WHATSMEOW_PAIR_DISPLAY_NAME="Chrome (Windows)"
```

No app Node, configure:

```env
WHATSMEOW_BRIDGE_URL="http://localhost:4000"
WHATSMEOW_BRIDGE_SECRET=""
```

## Endpoints

- `GET /status`: estado da conexao.
- `GET /qr`: QR atual e estado de pareamento.
- `POST /pair/code`: gera codigo de pareamento por telefone, corpo `{ "phone": "5511999999999" }`.
- `POST /config`: define o webhook ativo, corpo `{ "webhookUrl": "http://..." }`.
- `POST /send`: envia texto, corpo `{ "to": "5511999999999", "text": "Ola" }`.
- `POST /logout`: remove a sessao atual.

Para pareamento por codigo, o bridge precisa estar conectado ao websocket de login e ja ter recebido o primeiro evento de QR. O endpoint espera esse sinal por alguns segundos e entao chama `PairPhone`; o codigo expira junto com a janela de login do WhatsApp Web.

Mensagens recebidas sao enviadas para `WHATSMEOW_WEBHOOK_URL` e entram no Node por:

```text
POST /api/integrations/whatsmeow/incoming?tenantId=<TENANT_ID>
```

## Rodar

```bash
go mod tidy
go run .
```
