# Woo Tech IA

Plataforma omnicanal com WhatsApp não-oficial (whatsmeow), VoIP (WaCalls), AI Agents, CRM, Ouvidoria e automação.

## Stack

| Layer     | Tecnologia                                           |
| --------- | ---------------------------------------------------- |
| Frontend  | React 19 + Vite + TailwindCSS v4 + Recharts          |
| Backend   | Express + TypeScript + Prisma + BullMQ               |
| Database  | PostgreSQL (prod) / SQLite (dev)                     |
| Cache     | Redis                                                |
| WhatsApp  | whatsmeow (Go sidecar) + WaCalls (Go VoIP)           |
| AI        | Gemini / OpenAI / Anthropic / Groq                   |

## Quick Start (Docker Compose)

```bash
# 1. Clone e configure
cp .env.example .env
# Edite .env: preencha JWT_SECRET, JWT_REFRESH_SECRET, GEMINI_API_KEY

# 2. Suba tudo
docker compose up -d

# 3. Rode as migrations
docker compose exec app npx prisma migrate deploy

# 4. Popule o banco (opcional)
docker compose exec app npx prisma db seed

# 5. Acesse
#    App:    http://localhost:3333
#    Prisma Studio: npx prisma studio
```

## Desenvolvimento Local

```bash
# Terminal 1: whatsmeow bridge
cd whatsmeow-bridge
go build -o bridge.exe .
.\bridge.exe

# Terminal 2: Node + Vite
npm install
npm run dev

# Verificação local antes do commit
npm run lint
npm test
npm run build

# Ou use o script automatizado:
.\scripts\start-dev.ps1
```

Login: `super@vendaora.com` / `super123` → `/superadmin`

## Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  React SPA  │────▶│  Express API │────▶│  PostgreSQL  │
│  :5173/3333 │     │  :3333       │     │  :5432       │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       ┌──────────┐ ┌──────────┐ ┌──────────┐
       │ Redis    │ │whatsmeow │ │ WaCalls  │
       │ :6379    │ │ :4000    │ │ :8081    │
       └──────────┘ └──────────┘ └──────────┘
```

## Variáveis de Ambiente Críticas

| Variável                  | Obrigatória | Descrição                        |
| ------------------------- | ----------- | -------------------------------- |
| `DATABASE_URL`            | Sim         | PostgreSQL connection string     |
| `REDIS_URL`               | Sim (prod)  | Redis para filas BullMQ          |
| `JWT_SECRET`              | Sim         | Secret para tokens JWT           |
| `JWT_REFRESH_SECRET`      | Sim         | Secret para refresh tokens       |
| `GEMINI_API_KEY`          | Não         | Pelo menos 1 provedor de AI      |

## Produção

### Checklist de Produção

| Item | Status | Notas |
|------|--------|-------|
| ✅ Logger estruturado | JSON logging com níveis (info/warn/error/debug) | Substitui console.log |
| ✅ Rate limiting | Auth (10/15min), API (120/min), WhatsApp (30/min) | `express-rate-limit` |
| ✅ Validação Zod | Schemas em todas as rotas POST/PUT | `server/middleware/validate.ts` |
| ✅ RBAC | Roles (admin/supervisor/agent) + Permissions | `server/middleware/permissions.ts` |
| ✅ WebSocket | Socket.IO com auth JWT e salas | `server/lib/socket.ts` |
| ✅ Filas BullMQ | 3 filas (messages/llm/outgoing) com retry | `server/lib/queue.ts` |
| ✅ CSP | Strict em prod, permissivo em dev | `server.ts` |
| ✅ Error Boundary | Componente React com fallback UI | `src/components/ErrorBoundary.tsx` |
| ✅ Sentry | DSN configurável via env | `server/lib/sentry.ts` |
| ✅ Graceful Shutdown | Fecha HTTP, WebSocket, filas, DB | `server.ts:254` |
| ✅ Health Check | `/api/health` com DB + Redis | `server.ts:124` |
| ✅ Docker multi-stage | Test → Build → Run | `Dockerfile` |
| ✅ CI/CD | GitHub Actions: lint → test → build → deploy | `.github/workflows/` |
| ✅ Backup | Script PowerShell com retenção configurável | `scripts/backup.ps1` |

### Variáveis de Ambiente — Adicionais

| Variável | Obrigatória | Descrição |
| -------- | ----------- | --------- |
| `SENTRY_DSN` | Não | DSN do Sentry para error tracking |
| `ENABLE_EMBEDDED_WACALLS` | Não | Ativa tentativa de iniciar WaCalls local embutido se `WACALLS_URL` não estiver configurado |
| `ENABLE_EMBEDDED_WAHAPLUS` | Não | Ativa tentativa de iniciar WAHA+ local embutido se `WAHAPLUS_URL` não estiver configurado |

### Backup Automatizado

O script `npm run backup` faz dump do PostgreSQL (pg_dump) ou copia SQLite.

Para agendar backups automáticos:

**Linux (cron):**
```bash
# Diariamente às 3am
0 3 * * * cd /opt/vendaora && DATABASE_URL="postgresql://..." npm run backup >> /var/log/vendaora-backup.log 2>&1
```

**Docker:** Adicione ao docker-compose:
```yaml
backup:
  image: postgres:16-alpine
  entrypoint: |
    sh -c 'pg_dump "$$DATABASE_URL" | gzip > /backups/vendaora_$$(date +%%Y%%m%%d_%%H%%M%%S).sql.gz'
  environment:
    DATABASE_URL: "postgresql://postgres:${DB_PASSWORD}@postgres:5432/vendaora"
  volumes:
    - ./backups:/backups
```

## Problemas Conhecidos

### `NOT NULL constraint failed: session_message.seq`

Ocorre no banco SQLite interno do whatsmeow. Causa: incompatibilidade de schema ou DB corrompido.

**Solução:** delete o arquivo `whatsmeow-bridge/whatsmeow.db` e reconecte via QR Code.

```bash
docker compose stop whatsmeow-bridge
docker compose run --rm whatsmeow-bridge rm /data/whatsmeow.db
docker compose start whatsmeow-bridge
```
