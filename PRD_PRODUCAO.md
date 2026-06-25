# PRD - Vendaora 360: Roadmap para Produção

## Status Atual: v2.0.0 (Pré-alpha)

> **Stack**: React 19 + Vite + Express + Prisma + PostgreSQL (Supabase)
> **Agentes IA**: Gemini, OpenAI, Anthropic, Groq
> **Canais**: Web ✓ | WhatsApp (bridge Go) ✓ | Chatwoot ✓ | Instagram/Email (schema apenas)

---

## Índice
1. [Sistema de Acesso e Permissões (RBAC)](#1-sistema-de-acesso-e-permissões-rbac)
2. [Realtime e WebSocket](#2-realtime-e-websocket)
3. [Fila de Mensagens e Processamento Assíncrono](#3-fila-de-mensagens)
4. [Handoff e Roteamento Inteligente](#4-handoff-e-roteamento)
5. [Infraestrutura e Deploy](#5-infraestrutura-e-deploy)
6. [Testes e Qualidade](#6-testes-e-qualidade)
7. [Segurança](#7-segurança)
8. [Frontend e UX](#8-frontend-e-ux)
9. [WhatsApp Bridge Multi-Tenant](#9-whatsapp-bridge)
10. [Observabilidade e Logs](#10-observabilidade)
11. [Plano de Entregas (Sprints)](#11-plano-de-entregas)

---

## 1. SISTEMA DE ACESSO E PERMISSÕES (RBAC)

### Problema Atual
- `Role` e `Permission` existem no schema Prisma mas **nunca são usados**
- `tenantIsolation` só separa por tenant — qualquer usuário do mesmo tenant vê TUDO
- `GET /api/conversations` retorna **todas** conversas do tenant sem filtrar por assignee
- Não há conceito de "meus atendimentos vs atendimentos da equipe vs tudo"

### O que Implementar

#### 1.1 Perfis de Acesso (Roles)

| Role | Acesso |
|------|--------|
| `admin` | Tudo no tenant (configurar agentes, canais, ver todos atendimentos) |
| `supervisor` | Ver atendimentos da equipe + reports, não pode configurar |
| `agent` | Só seus próprios atendimentos delegados |
| `bot` | Apenas API, sem acesso ao dashboard |

#### 1.2 Schema — Seeds de Roles

```prisma
// Já existe, mas criar roles padrão no seed:
- admin:  ["tickets.read.all", "tickets.write", "agents.manage", "channels.manage", "settings.read", "settings.write", "team.read"]
- supervisor: ["tickets.read.team", "tickets.write", "reports.read", "team.read"]
- agent:  ["tickets.read.assigned", "tickets.write.assigned"]
```

#### 1.3 Middleware de Autorização

```typescript
// server/middleware/permissions.ts
function requirePermission(action: string, subject: string) {
  return async (req, res, next) => {
    const userRoles = await prisma.userRole.findMany({
      where: { userId: req.user.userId },
      include: { role: { include: { permissions: true } } },
    });
    const hasPermission = userRoles.some(ur =>
      ur.role.permissions.some(p => p.action === action && p.subject === subject)
    );
    if (!hasPermission) return res.status(403).json({ error: "Acesso negado" });
    next();
  };
}
```

#### 1.4 Filtro Automático por Escopo

```typescript
// No GET /conversations — adicionar filtro por escopo:
function scopeFilter(user, scope) {
  if (scope === 'assigned') return { assignedUserId: user.userId };
  if (scope === 'team') {
    const teamMemberIds = getTeamMemberIds(user);
    return { assignedUserId: { in: teamMemberIds } };
  }
  return {}; // all — só admin/supervisor
}
```

#### 1.5 UI de Gerenciamento

- Página `/app/settings/team` para admin gerenciar usuários e roles
- Seletor de papel no convite de novo usuário
- Badge visual no Inbox indicando "Meus Atendimentos" / "Da Equipe" / "Todos"

---

## 2. REALTIME E WEBSOCKET

### Problema Atual
- Zero WebSocket — sem atualizações em tempo real
- Usuário precisa dar refresh manual para ver novas mensagens
- Sem indicadores de "digitando", "online", "entregue", "visto"

### O que Implementar

#### 2.1 Socket.IO Server

```typescript
// server/lib/socket.ts
import { Server } from "socket.io";

export function setupSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    // Verificar JWT e extrair tenantId + userId
    const user = verifyToken(token);
    socket.data.user = user;
    socket.join(`tenant:${user.tenantId}`);
    socket.join(`user:${user.userId}`);
    next();
  });

  io.on("connection", (socket) => {
    // Ingressar nas salas das conversas que o user pode ver
    socket.on("join:conversation", (convId) => {
      socket.join(`conv:${convId}`);
    });
  });

  return io;
}

// Exports para broadcast:
// io.to(`tenant:${tenantId}`).emit("message:new", msg)
// io.to(`conv:${convId}`).emit("message:new", msg)
// io.to(`user:${userId}`).emit("conversation:assigned", conv)
```

#### 2.2 Eventos em Tempo Real

| Evento | Sentido | Descrição |
|--------|---------|-----------|
| `message:new` | Server → Client | Nova mensagem na conversa |
| `conversation:updated` | Server → Client | Status, assignee, prioridade mudou |
| `agent:typing` | Bidirectional | Indicador de digitação |
| `conversation:assigned` | Server → Client | Notificar usuário designado |
| `agent:status` | Server → Client | Agente IA online/offline/processing |

#### 2.3 Frontend — Hook useSocket

```typescript
// src/hooks/useSocket.ts
export function useSocket() {
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem("vendaora_token");
    const s = io(API_URL, { auth: { token } });
    setSocket(s);
    return () => s.disconnect();
  }, []);
  return socket;
}
```

---

## 3. FILA DE MENSAGENS E PROCESSAMENTO ASSÍNCRONO

### Problema Atual
- Tudo síncrono — request HTTP bloqueia até LLM responder (pode levar 10-30s)
- Sem retry automático em falha de LLM
- Sem priorização de mensagens
- Sem rate limiting por provider

### O que Implementar

#### 3.1 BullMQ + Redis

```typescript
// server/lib/queue.ts
import { Queue, Worker } from "bullmq";

export const messageQueue = new Queue("messages", {
  connection: { host: "localhost", port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
  },
});

// Workers
new Worker("messages", async (job) => {
  const { conversationId, messageId, agentId } = job.data;
  // 1. Buscar mensagem + contexto
  // 2. Executar LLM (com timeout)
  // 3. Salvar resposta
  // 4. Emitir Socket.IO
  // 5. Verificar handoff
}, { connection: { host: "localhost", port: 6379 } });
```

#### 3.2 Filas Necessárias

| Fila | Worker | Prioridade |
|------|--------|------------|
| `messages:incoming` | Processar mensagem recebida → rotear para agente | Alta |
| `messages:llm` | Executar chamada LLM | Média |
| `messages:outgoing` | Enviar resposta via canal (whatsapp, email, etc.) | Alta |
| `messages:handoff` | Verificar se precisa transferir para humano | Baixa |
| `agents:training` | Atualizar base de conhecimento / embeddings | Baixa |

#### 3.3 Benefícios

- Timeout de LLM não bloqueia request
- Retry automático (3 tentativas com backoff)
- Filas visíveis no dashboard Bull Board
- Escalabilidade horizontal (mais workers = mais paralelismo)

---

## 4. HANDOFF E ROTEAMENTO INTELIGENTE

### Problema Atual
- `orchestrator.ts` só verifica keywords no response do agente
- Não há router de entrada (qual agente atende?)
- Não há detecção de sentimento/escalation
- Transferência para humano é manual

### O que Implementar

#### 4.1 Router de Entrada (Intent Classifier)

```typescript
// server/lib/intent-router.ts
export async function routeMessage(tenantId, message) {
  // 1. Verificar regras de negócio: departamento → agente
  // 2. Se não houver regra, usar LLM para classificar intenção
  // 3. Retornar { agentId, confidence, needsHuman }

  const intent = await classifyIntent(message, tenantId);
  const agent = await matchAgent(intent, tenantId);
  return agent;
}
```

#### 4.2 Regras de Handoff (no AiAgent)

```prisma
model AiAgent {
  // ... campos existentes ...
  handoffRules   Json?
  // {
  //   "enabled": true,
  //   "keywords": ["gerente", "reclamação", "cancelar"],
  //   "sentimento": "negativo",
  //   "departmentId": "suporte-vendas",
  //   "maxRetries": 3,
  //   "fallbackMessage": "Transferindo para um atendente..."
  // }
}
```

#### 4.3 Fluxo de Decisão

```
Mensagem → Intent Router
  ├── Confiança > 0.8 → Agente específico
  ├── 0.5 < Confiança < 0.8 → Perguntar clarification
  └── Confiança < 0.5 → Humano + "Não entendi, vou transferir"

Após 2 falhas seguidas do agente → Handoff automático
Cliente com sentimento negativo + keywords → Escalation imediato
```

#### 4.4 Painel de Handoff

- Aba "Aguardando Humano" no Inbox
- Fila de conversas que precisam de atendente humano
- Botão "Assumir Conversa" (transferir de IA para humano)
- Histórico da conversa com IA visível para o humano

---

## 5. INFRAESTRUTURA E DEPLOY

### Problema Atual
- Sem Dockerfile
- Sem docker-compose.yml
- Sem CI/CD
- Build aponta para Supabase mas sem script de migração automática

### O que Implementar

#### 5.1 Docker

```dockerfile
# Dockerfile (Node)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3333
CMD ["node", "dist/server.cjs"]
```

```dockerfile
# whatsmeow-bridge/Dockerfile (Go)
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o bridge .
FROM alpine:3.19
COPY --from=builder /app/bridge /bridge
EXPOSE 4000
CMD ["/bridge"]
```

#### 5.2 docker-compose.yml

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vendaora
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  app:
    build: .
    depends_on:
      postgres: condition: service_healthy
      redis: condition: service_healthy
    environment:
      DATABASE_URL: "postgresql://postgres:${DB_PASSWORD}@postgres:5432/vendaora"
      REDIS_URL: "redis://redis:6379"
    ports:
      - "3333:3333"

  whatsmeow-bridge:
    build: ./whatsmeow-bridge
    environment:
      WHATSMEOW_WEBHOOK_URL: "http://app:3333/api/integrations/whatsmeow/incoming?tenantId=${TENANT_ID}"
      WHATSMEOW_BRIDGE_SECRET: ${WHATSMEOW_BRIDGE_SECRET}
    ports:
      - "4000:4000"

  # Opcional: Bull Board para monitorar filas
  bull-board:
    build: .
    command: npx bull-board
    ports:
      - "3344:3344"

volumes:
  pgdata:
```

#### 5.3 CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm test

  build-and-push:
    needs: test
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t vendaora/app .
      - run: docker push ...
```

#### 5.4 Deploy em Produção

| Provedor | Serviço | Custo estimado |
|----------|---------|---------------|
| Railway / Render | Node + Redis + Postgres | ~$20-50/mês |
| AWS ECS / Fargate | Containers gerenciados | ~$50-200/mês |
| DigitalOcean App Platform | PaaS simples | ~$12-48/mês |
| VPS (Hetzner) + Docker Compose | Autogerenciado | ~$8-30/mês |

**Recomendação MVP**: Railway (Node + Postgres + Redis com deploy via GitHub)

---

## 6. TESTES E QUALIDADE

### Problema Atual
- Zero testes
- `npm run lint` = `tsc --noEmit` (só verifica tipos)
- Sem cobertura

### O que Implementar

#### 6.1 Stack de Testes

```json
{
  "devDependencies": {
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "supertest": "^7.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

#### 6.2 O que Testar (Prioridade)

| Prioridade | Tipo | O que testar |
|-----------|------|-------------|
| P0 | Unit | `agent-engine.ts` — CRUD, execução de LLM mockada |
| P0 | Unit | `providers.ts` — parsing de resposta de cada provider |
| P0 | Unit | `auth.ts` — geração/verificação de token |
| P0 | Unit | `knowledge-base.ts` — chunking, search |
| P0 | Unit | `plan-enforcer.ts` — limites por plano |
| P1 | Integration | Rotas de conversas e agentes com banco de teste |
| P1 | Integration | Fluxo de login → criar conversa → enviar mensagem |
| P1 | Integration | Webhook Chatwoot → materializar conversa |
| P2 | E2E | Fluxo completo: login → inbox → enviar mensagem |
| P2 | E2E | Painel superadmin: CRUD tenants, planos |

#### 6.3 Config Vitest

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    testTimeout: 15000,
  },
});
```

---

## 7. SEGURANÇA

### Problema Atual
- `JWT_SECRET` default "change-this-to-a-random-secret-in-production"
- `contentSecurityPolicy: false` — sem proteção CSP
- CORS permite `localhost:5173` mesmo em produção
- Sem rate limiting
- Sem validação de schemas (zod/joi)
- Senhas com hash bcrypt (ok) mas sem política de complexidade

### O que Implementar

#### 7.1 Checklist de Segurança

- [ ] **JWT_SECRET forte** — gerar via `openssl rand -hex 64` e usar env var
- [ ] **Rate limiting** — `express-rate-limit` por IP e por rota
- [ ] **Validação de input** — Zod schemas para todas as rotas
- [ ] **CSP habilitada** — configurar Content-Security-Policy
- [ ] **CORS produção** — permitir apenas domínios configurados
- [ ] **Helmet configurado** — já tem mas CSP está falso
- [ ] **Headers de segurança** — `X-Frame-Options`, `X-Content-Type-Options`
- [ ] **Password policy** — mínimo 8 chars, 1 maiúsculo, 1 número
- [ ] **Refresh token rotation** — invalidar após uso
- [ ] **Audit log** — já existe modelo `AuditLog` no schema mas nunca é populado

#### 7.2 Zod Validation Middleware

```typescript
// server/middleware/validate.ts
import { z } from "zod";

export function validate(schema: z.ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Dados inválidos",
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };
}

// Uso:
const createAgentSchema = z.object({
  name: z.string().min(2).max(100),
  segment: z.enum(["vendas", "suporte", ...]),
  llmConfig: z.object({
    provider: z.enum(["gemini", "openai", "anthropic", "groq"]),
    model: z.string(),
    temperature: z.number().min(0).max(2).optional(),
  }),
});

router.post("/", validate(createAgentSchema), authMiddleware, handler);
```

#### 7.3 Rate Limiting

```typescript
import rateLimit from "express-rate-limit";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10, // 10 tentativas de login
  message: { error: "Muitas tentativas. Tente novamente em 15 minutos." },
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min
  max: 60,
});

app.use("/api/auth/login", authLimiter);
app.use("/api/", apiLimiter);
```

---

## 8. FRONTEND E UX

### Problema Atual
- Dashboard com dados mock (hardcoded no componente)
- Inbox sem realtime
- Sem lazy loading nas rotas
- Sem notificações (toast/sound)
- Sem tratamento de erros consistente
- Mobile: sidebar não colapsa, Inbox não adaptado

### O que Implementar

#### 8.1 Dashboard Real

- Conectar Dashboard aos endpoints reais do backend
- KPI cards com dados dinâmicos:
  - `GET /api/analytics/overview?period=today`
  - `GET /api/analytics/agent-performance?agentId=...`
  - `GET /api/analytics/conversations-by-channel`

#### 8.2 Melhorias no Inbox

- Integração com WebSocket para tempo real
- Badge de "não lidas" nas conversas
- Indicador de "digitando" do cliente
- Botão "Assumir" conversa (mudar assignee)
- Modal de transferência para departamento/outro agente
- Atalhos de teclado (Ctrl+Enter enviar, Esc fechar)

#### 8.3 Performance

- `React.lazy()` para todas as páginas
- Code splitting por rota
- Infinite scroll na lista de conversas
- Debounce na busca de contatos
- Memoização de componentes pesados

#### 8.4 Estado Global

```typescript
// src/hooks/useStore.ts — estado global (sem zustand, usar React Context)
// Estado:
{
  conversations: Map<id, Conversation>,
  activeConversationId: string | null,
  unreadCount: Record<id, number>,
  agents: Agent[],
  currentUser: User | null,
  socket: Socket | null,
  filters: { status, channel, assignedTo }
}
```

---

## 9. WHATSAPP BRIDGE MULTI-TENANT

### Problema Atual
- Bridge Go single-instance (só 1 conexão)
- Sessão salva em SQLite local
- Webhook sem retry
- Sem gerenciamento de múltiplos números

### O que Implementar

#### 9.1 Arquitetura Multi-Instância

```
Node.js (Express)
  └── ChannelInstance (whatsmeow-1) → Bridge Go instance
  └── ChannelInstance (whatsmeow-2) → Bridge Go instance 2

Cada instance:
  - PID próprio ou goroutine separada
  - Sessão própria (SQLite ou Redis)
  - Webhook próprio para o tenant correto
```

#### 9.2 Retry de Webhook

```go
func (s *bridgeState) postWebhookWithRetry(payload any) {
  for i := 0; i < 3; i++ {
    err := s.postWebhook(payload)
    if err == nil { return }
    time.Sleep(time.Duration(math.Pow(2, float64(i))) * time.Second)
  }
  // Dead letter: salvar para retry manual
  s.saveDeadLetter(payload)
}
```

#### 9.3 Endpoints Adicionais no Bridge

| Endpoint | Descrição |
|----------|-----------|
| `POST /webhook-config` | Configurar URL do webhook dinamicamente |
| `GET /media/:messageId` | Download de mídia (imagem, audio, video) |
| `POST /presence` | Configurar presença (online/typing) |

---

## 10. OBSERVABILIDADE E LOGS

### Problema Atual
- `console.log` em todo lugar
- Sem estrutura de logs (níveis, contexto, formato JSON)
- Sem rastreamento de requisições (request ID)
- Sem métricas

### O que Implementar

#### 10.1 Logger Estruturado

```typescript
// server/lib/logger.ts
export const logger = {
  info: (msg, meta?) => console.log(JSON.stringify({ level: "info", msg, ...meta, timestamp: new Date().toISOString() })),
  error: (msg, meta?) => console.error(JSON.stringify({ level: "error", msg, ...meta, timestamp: new Date().toISOString() })),
  warn: (msg, meta?) => console.warn(JSON.stringify({ level: "warn", msg, ...meta, timestamp: new Date().toISOString() })),
};
```

#### 10.2 Request ID Middleware

```typescript
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
});
```

#### 10.3 Métricas (Prometheus)

- `http_requests_total` — total de requests por rota
- `http_request_duration_seconds` — latência
- `llm_calls_total` — chamadas por provider
- `llm_call_duration_seconds` — latência do LLM
- `llm_tokens_total` — tokens consumidos (pra billing)
- `messages_processed_total` — mensagens processadas
- `active_connections` — conexões whatsapp ativas

#### 10.4 Audit Log Funcional

O modelo `AuditLog` já existe no schema — basta popular:

```typescript
// server/lib/audit.ts
export async function logAction(params: {
  tenantId: string,
  userId?: string,
  action: string,      // "conversation.assigned", "agent.created", "user.login"
  entityType: string,  // "Conversation", "AiAgent", "User"
  entityId: string,
  ipAddress?: string,
  metadata?: any,
}) {
  await prisma.auditLog.create({ data: params });
}
```

---

## 11. PLANO DE ENTREGAS (SPRINTS)

### FASE 0 — FUNDAÇÃO (Sprint 1-2) • ~2 semanas

| Prioridade | Tarefa | Esforço | Depende de |
|-----------|--------|---------|------------|
| 🔴 P0 | **RBAC + Permissionamento** — Middleware de autorização, seeds de roles, filtro por escopo | 5 dias | — |
| 🔴 P0 | **Zod validation** em todas as rotas POST/PUT | 2 dias | — |
| 🔴 P0 | **Rate limiting** — proteger auth e API | 1 dia | — |
| 🔴 P0 | **JWT_SECRET** — validação em startup, erro se default | 0.5 dia | — |
| 🔴 P0 | **Dockerfile + docker-compose** — Node + Postgres + Redis | 2 dias | — |
| 🟡 P1 | **WebSocket (Socket.IO)** — setup server + hook frontend | 3 dias | Docker |
| 🟡 P1 | **BullMQ + Redis** — fila de mensagens, workers | 3 dias | Docker |
| 🟡 P1 | **AuditLog funcional** — middleware que loga operações | 1 dia | — |

### FASE 1 — REALTIME E INBOX (Sprint 3-4) • ~2 semanas

| Prioridade | Tarefa | Esforço |
|-----------|--------|---------|
| 🔴 P0 | Inbox com WebSocket — mensagens em tempo real | 3 dias |
| 🔴 P0 | Badge de não lidas + unread count | 1 dia |
| 🔴 P0 | Botão "Assumir Atendimento" (assign) | 1 dia |
| 🔴 P0 | Modal de transferência (departamento/agente) | 2 dias |
| 🟡 P1 | Indicador de digitação | 1 dia |
| 🟡 P1 | Painel "Aguardando Humano" | 2 dias |
| 🟡 P1 | Filtros rápidos: "Meus", "Da Equipe", "Todos" | 1 dia |

### FASE 2 — AGENTES E ROTEAMENTO (Sprint 5-6) • ~2 semanas

| Prioridade | Tarefa | Esforço |
|-----------|--------|---------|
| 🔴 P0 | **Intent Router** — Classificador que decide qual agente atende | 3 dias |
| 🔴 P0 | **Handoff automático** — Regras de escalation (sentimento + keywords) | 2 dias |
| 🔴 P0 | Processamento via fila (BullMQ) — não bloquear request HTTP | 2 dias |
| 🟡 P1 | Memória de conversa com resumo automático (LLM) | 2 dias |
| 🟡 P1 | Agente Supervisor — orquestra especialistas | 3 dias |
| 🟢 P2 | Workflows visuais (React Flow) | 4 dias |

### FASE 3 — INFRA E TESTES (Sprint 7-8) • ~2 semanas

| Prioridade | Tarefa | Esforço |
|-----------|--------|---------|
| 🔴 P0 | **Testes unitários** — agent-engine, providers, auth, plan-enforcer | 3 dias |
| 🔴 P0 | **Testes de integração** — rotas principais | 3 dias |
| 🔴 P0 | **CI/CD (GitHub Actions)** — test + build + deploy | 2 dias |
| 🟡 P1 | **Logger estruturado** + Request ID | 1 dia |
| 🟡 P1 | **Métricas** (Prometheus ou simples counters) | 2 dias |
| 🟡 P1 | **Graceful shutdown** — fechar conexões corretamente | 1 dia |

### FASE 4 — FINALIZAÇÃO (Sprint 9-10) • ~2 semanas

| Prioridade | Tarefa | Esforço |
|-----------|--------|---------|
| 🔴 P0 | **Dashboard real** — conectar a dados reais | 2 dias |
| 🟡 P1 | **Páginas de admin** — Settings, Team, Roles | 3 dias |
| 🟡 P1 | **Lazy loading** + Code splitting no frontend | 1 dia |
| 🟡 P1 | **Notificações** (toast + sound) | 1 dia |
| 🟢 P2 | **WhatsApp multi-instância** | 3 dias |
| 🟢 P2 | **White-label funcional** | 2 dias |
| 🟢 P2 | **Testes E2E** (Playwright) | 3 dias |

---

## RESUMO EXECUTIVO

### O que tem hoje
✅ Arquitetura sólida (React + Express + Prisma + PostgreSQL)
✅ CRUD de agentes, conversas, mensagens
✅ 4 providers de LLM funcionando
✅ Bridge WhatsApp Go funcional
✅ Schema multi-tenant com planos
✅ Superadmin para gestão
✅ Chatwoot adapter

### O que é CRÍTICO para produção
1. **RBAC + Permissionamento** — sem isso, qualquer atendente vê TUDO
2. **WebSocket** — sem realtime não é um sistema de atendimento
3. **Fila de mensagens** — sem fila, LLM bloqueia a API
4. **Validação de input + Rate limiting** — segurança básica
5. **Docker + CI/CD** — deploy confiável
6. **Testes** — sem testes, cada deploy é um risco

### Estimativa total
**10 sprints (~10 semanas)** com 1 desenvolvedor full-stack
**6 sprints (~6 semanas)** para MVP mínimo (Fase 0 + Fase 1 + testes críticos)
