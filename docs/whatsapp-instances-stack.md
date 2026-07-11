# Analise: instancias WhatsApp e stack Portainer

## Diagnostico

O erro da tela acontece por dois motivos combinados:

1. O `whatsmeow-bridge` atual e single-session. No codigo Go ele cria um unico `whatsmeow.Client` usando `GetFirstDevice` e um unico SQLite em `/data/whatsmeow-v2.db`. Portanto, varias conexoes cadastradas no banco nao geram varias sessoes reais de WhatsApp.
2. A stack anexada sobe o bridge com `golang:1.25-alpine` fazendo `apk add`, `git clone` e `go run` a cada deploy. Se a rede, o GitHub, o build Go ou o tempo de inicializacao falharem, a API recebe `Bridge WhatsApp offline` e o QR nao e gerado.

## Decisao aplicada

- WooTech IA 1 (`whatsmeow`) fica limitado a uma conexao por tenant enquanto `WHATSMEOW_MULTI_INSTANCE=false`.
- WooTech IA 2 (`WAHA+`) deve ser usado para multiplas sessoes simultaneas.
- A API bloqueia novas conexoes `whatsmeow` duplicadas para evitar registros sem bridge proprio.
- Rotas de status, QR, logout e delete nao tentam controlar o bridge real a partir de conexoes duplicadas antigas.
- Mensagens recebidas por `whatsmeow` e por `wahaplus` entram no mesmo pipeline de conversas e aparecem na aba Mensagens.

## Stack recomendada

Use imagem pronta para o bridge, nao `go run` em producao:

```yaml
api:
  environment:
    - "WHATSMEOW_BRIDGE_URL=http://whatsmeow-bridge:4000"
    - "WHATSMEOW_WEBHOOK_URL=http://vendedoraai_api:3333/api/integrations/whatsmeow/incoming?tenantId=seed-tenant"
    - "WHATSMEOW_BRIDGE_SECRET=${WHATSMEOW_BRIDGE_SECRET}"
    - "WHATSMEOW_MULTI_INSTANCE=false"
    - "WAHAPLUS_URL=http://vendedoraai_wahaplus:3000"
    - "WAHAPLUS_WEBHOOK_SECRET="
    - "WACALLS_URL=http://vendedoraai_wacalls:8081"

whatsmeow-bridge:
  image: ghcr.io/fluowai/vendora/whatsmeow-bridge:latest
  environment:
    - "PORT=4000"
    - "WHATSMEOW_DB_PATH=file:/data/whatsmeow-v2.db?_pragma=foreign_keys(1)"
    - "WHATSMEOW_WEBHOOK_URL=http://vendedoraai_api:3333/api/integrations/whatsmeow/incoming?tenantId=seed-tenant"
    - "WHATSMEOW_BRIDGE_SECRET=${WHATSMEOW_BRIDGE_SECRET}"
  volumes:
    - whatsmeow_data:/data
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:4000/health"]
    interval: 30s
    timeout: 5s
    start_period: 240s
    retries: 5
  deploy:
    replicas: 1
```

Para varias conexoes simultaneas, mantenha o servico `wahaplus` da stack versionada e crie as sessoes pela aba WooTech IA 2.

Configure o WAHA+ como servidor separado e aponte o webhook para a API:

```yaml
wahaplus:
  image: ${WAHAPLUS_IMAGE:-devlikeapro/waha}
  environment:
    - "WAHA_LICENSE_KEY=${WAHAPLUS_LICENSE:-}"
    - "WAHA_WEBHOOK_URL=http://vendedoraai_api:3333/api/integrations/wahaplus/incoming"
    - "WAHA_WEBHOOK_EVENTS=message,message.any"
    - "WHATSAPP_HOOK_URL=http://vendedoraai_api:3333/api/integrations/wahaplus/incoming"
    - "WHATSAPP_HOOK_EVENTS=message"
  volumes:
    - wahaplus_data:/app/.sessions
    - wahaplus_data:/app/.media
  deploy:
    replicas: 1
```

## Checklist de producao

- Publicar imagens `frontend`, `api` e `whatsmeow-bridge` antes de atualizar a stack.
- Remover da stack o comando `git clone && go run .`.
- Manter `whatsmeow-bridge` com `replicas: 1`.
- Manter `wahaplus` como servico separado do `whatsmeow-bridge`.
- Conferir logs do bridge: `docker service logs <stack>_whatsmeow-bridge`.
- Conferir saude pela rede interna: `http://whatsmeow-bridge:4000/health`.
- Conferir saude do WAHA+: `http://vendedoraai_wahaplus:3000/api/sessions`.
- Apagar conexoes `whatsmeow` duplicadas antigas pela tela; deixe somente uma no WooTech IA 1.
