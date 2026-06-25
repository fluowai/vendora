# Plano: Máquina de Agentes de Atendimento via WhatsApp (whatsmeow)

## 1. ANÁLISE DO SISTEMA ATUAL

### Stack Atual
| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 + Vite + Tailwind v4 + Motion + Recharts |
| Backend | Express + tsx runtime (TypeScript puro) |
| ORM | Prisma + PostgreSQL |
| LLMs | Gemini, OpenAI, Anthropic, Groq |
| Auth | JWT (middleware próprio) |
| Canais | web, whatsapp, instagram, email (definidos em schema mas só web implementado) |
| Filas | Nenhuma |
| WebSocket | Nenhum |

### Estrutura de Agentes Atual
- `server/lib/agent-engine.ts` — CRUD + execução de agentes
- `server/lib/orchestrator.ts` — Orquestração multi-agente (encadeamento)
- `server/lib/providers.ts` — 4 LLM providers (Gemini, OpenAI, Anthropic, Groq)
- `server/lib/knowledge-base.ts` — RAG simples (keyword matching, sem embeddings)
- `prisma/schema.prisma` — Modelos: AiAgent, Conversation, Message, Channel, ChannelInstance, Contact, etc.

### Lacunas Detectadas
1. **Sem integração real com WhatsApp** — só mock data no frontend
2. **Sem WebSocket** — mensagens em tempo real não existem
3. **Sem fila de mensagens** — sem escalabilidade horizontal
4. **RAG básico** — busca por keywords, sem embeddings vetoriais
5. **Sem handoff humano** — não há rota de transferência para atendente
6. **Sem sessão/estado** — conversations só persistem no banco, sem cache
7. **Orquestrador simples** — encadeamento linear, sem grafos/DAG
8. **Marketplace apenas conceitual** — endpoints existem mas sem dados reais
9. **Sem webhooks** — sem notificações de eventos
10. **Automações visuais** — apenas mock (sem React Flow real)

---

## 2. ARQUITETURA PROPOSTA (whatsmeow + Multi-Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│                    VENDAORA 360 PLATFORM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌─────────────┐  │
│  │  Web     │   │ REST API │   │ GraphQL  │   │  WebSocket   │  │
│  │  SPA     │   │ Express  │   │ (futuro) │   │  (Socket.IO) │  │
│  └────┬─────┘   └────┬─────┘   └──────────┘   └──────┬──────┘  │
│       │              │                                │         │
│       └──────────────┼────────────────────────────────┘         │
│                      ▼                                          │
│           ┌────────────────────┐                                │
│           │   AGENT ENGINE     │  Core de execução de LLM       │
│           │   (execução,       │                                │
│           │    orquestração,   │                                │
│           │    handoff,        │                                │
│           │    RAG + vetorial) │                                │
│           └────────┬───────────┘                                │
│                    │                                            │
│         ┌──────────┼──────────┐                                 │
│         ▼          ▼          ▼                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │ Message  │ │  Queue   │ │  Cache   │                        │
│  │  Bus     │ │ (BullMQ) │ │ (Redis)  │                        │
│  │ Kafka/Rab│ │          │ │          │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
│                                                    │           │
│         ┌──────────────────────────────────────────┘           │
│         ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐       │
│  │           WHATSAPP GATEWAY (whatsmeow)               │       │
│  │  ┌─────────────────────────────────────────────────┐ │       │
│  │  │  Go Sidecar Service (whatsmeow-bridge)          │ │       │
│  │  │  • Conexão Multi-Device (QR Code)               │ │       │
│  │  │  • Reconexão automática                         │ │       │
│  │  │  • Enfileiramento de mensagens                 │ │       │
│  │  │  • Download de mídia (imagem, audio, doc)       │ │       │
│  │  │  • Webhook para Node.js via HTTP/WS             │ │       │
│  │  └─────────────────────────────────────────────────┘ │       │
│  └─────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. PLANO DE IMPLEMENTAÇÃO POR FASES

### FASE 0 — Fundação (Sprint 1-2)
**Objetivo: Preparar o terreno para receber mensagens reais**

| Tarefa | Descrição | Arquivos |
|--------|-----------|----------|
| 0.1 | **Fila de mensagens** — Instalar BullMQ + Redis. Criar `server/lib/queue.ts` com workers para processamento assíncrono | `server/lib/queue.ts`, `docker-compose.yml` |
| 0.2 | **WebSocket em tempo real** — Socket.IO no server para broadcast de mensagens novas pro frontend | `server.ts:68`, `server/lib/socket.ts` |
| 0.3 | **Cache de sessão** — Redis para cache de conversations ativas (evitar DB query a cada mensagem) | `server/lib/cache.ts` |
| 0.4 | **RAG vetorial** — Substituir keyword matching por embeddings (OpenAI ou local via pgvector) | `server/lib/knowledge-base.ts`, migração Prisma |
| 0.5 | **Sistema de Handoff** — Regras de transferência agente→humano por departamento | `server/lib/handoff.ts`, schema `AiAgent.handoffRules` |

### FASE 1 — Gateway WhatsApp (Sprint 3-4)
**Objetivo: Conectar whatsmeow e receber/enviar mensagens reais**

| Tarefa | Descrição |
|--------|-----------|
| 1.1 | **Criar serviço Go sidecar** — `whatsmeow-bridge/` com go module |
| 1.2 | **Autenticação via QR Code** — Endpoint REST pra gerar QR, WebSocket pra escanear |
| 1.3 | **Webhook de mensagens** — Toda mensagem recebida → POST `/api/whatsapp/incoming` |
| 1.4 | **Fila de envio** — Node.js enfileira respostas, Go worker envia |
| 1.5 | **Download de mídia** — Imagens, áudios, documentos → upload S3 |
| 1.6 | **Reconexão automática** — Keep-alive, re-scan QR se necessário |

### FASE 2 — Motor Multi-Agentes (Sprint 5-6)
**Objetivo: Roteamento inteligente de mensagens entre agentes**

| Tarefa | Descrição |
|--------|-----------|
| 2.1 | **Router de entrada** — Classificador de intenção (LLM) que decide qual agente atende |
| 2.2 | **Orquestrador DAG** — Substituir encadeamento linear por grafo direcionado (workflows) |
| 2.3 | **Memória de conversa** — Histórico com resumo automático (LLM sumariza a cada N msgs) |
| 2.4 | **Handoff inteligente** — Detecção automática de escalation com contexto |
| 2.5 | **Agente Supervisor** — Coordena múltiplos agentes especialistas |

### FASE 3 — Dashboard 360 + Analytics (Sprint 7-8)
**Objetivo: Visibilidade total da operação**

| Tarefa | Descrição |
|--------|-----------|
| 3.1 | **Métricas em tempo real** — Conversas ativas, tempo de resposta, SLA via WebSocket |
| 3.2 | **Fila de atendimento** — Painel mostrando conversas aguardando agente humano |
| 3.3 | **Relatórios** — Volume por canal, horário, agente, taxa de resolução |
| 3.4 | **Dashboard de Agentes** — Performance individual de cada IA |

### FASE 4 — Automações Visuais (Sprint 9-10)
**Objetivo: Builder no-code de fluxos**

| Tarefa | Descrição |
|--------|-----------|
| 4.1 | **React Flow** — Integrar `reactflow` para builder visual |
| 4.2 | **Nós do builder** — Gatilho, Condição, Ação (enviar msg, criar ticket, webhook, transferir) |
| 4.3 | **Execução de workflow** — Motor que interpreta o JSON do grafo |
| 4.4 | **Templates de automação** — Fluxos pré-prontos |

---

## 4. DETALHAMENTO TÉCNICO

### 4.1 Estrutura do Bridge whatsmeow (Go sidecar)

```go
// whatsmeow-bridge/main.go
- HTTP server (porta 4000)
  - GET  /qr          → retorna QR code atual (base64)
  - POST /send         → enfileira mensagem pra enviar
  - GET  /status       → conexão ativa?
  - POST /logout       → desconecta

- WebSocket (porta 4001)
  - Eventos: message, qr_update, connected, disconnected, error

- Reconexão
  - Salva session em arquivo .json (re-usable)
  - Auto-reconnect com backoff exponencial
```

### 4.2 Fluxo de Mensagem (Rota Crítica)

```
WhatsApp → whatsmeow → [Webhook HTTP] → Express (/api/whatsapp/incoming)
  → BullMQ Queue (processamento)
  → Agent Router (classificador LLM: qual agente?)
  → Agent Engine (executa LLM com contexto)
  → Handoff Check (precisa de humano?)
  → BullMQ Queue (envio)
  → whatsmeow → WhatsApp
  → Socket.IO → Frontend (notificação em tempo real)
```

### 4.3 Schema Prisma — Novos Modelos

```prisma
model WhatsAppSession {
  id        String   @id @default(uuid())
  tenantId  String
  number    String   @unique
  session   String   (JSON com dados de sessão criptografados)
  status    String   (connected | disconnected | expired)
  qrCode    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model QueueMessage {
  id           String   @id @default(uuid())
  tenantId     String
  conversationId String
  direction    String   (inbound | outbound)
  status       String   (pending | processing | sent | failed | delivered | read)
  content      String
  mediaUrl     String?
  retryCount   Int      @default(0)
  scheduledAt  DateTime?
  sentAt       DateTime?
  createdAt    DateTime @default(now())
}
```

### 4.4 Handoff Rules (no AiAgent)

```prisma
model AiAgent {
  // ... campos existentes ...
  handoffRules   Json?   @default("{\\"enabled\\": false, \\"keywords\\": [], \\"departmentId\\": null, \\"maxRetries\\": 3}")
}
```

---

## 5. CUSTOS E INFRA

### Dependências Novas
| Recurso | Tecnologia | Custo |
|---------|-----------|-------|
| Filas | BullMQ + Redis | Redis free (até 30MB) |
| Cache | Redis | incluso acima |
| Vetores | pgvector (PostgreSQL extension) | gratuito |
| WebSocket | Socket.IO | gratuito |
| Mídia | S3-compatible (MinIO dev, AWS S3 prod) | MinIO free |
| whatsmeow | Go service | código livre |
| Deployment | Docker Compose (Node + Go + Redis + Postgres) | - |

### Go Module (whatsmeow-bridge/go.mod)
```
module github.com/vendaora/whatsmeow-bridge
go 1.22
require (
  go.mau.fi/whatsmeow v0.0.0-xxxx
  google.golang.org/protobuf v1.34.0
)
```

---

## 6. PRIORIZAÇÃO RECOMENDADA

```
Sprint 1-2:  Fase 0 (Fundação)         → ~2 semanas
Sprint 3-4:  Fase 1 (WhatsApp)          → ~2 semanas
Sprint 5-6:  Fase 2 (Multi-Agent)       → ~2 semanas
Sprint 7-8:  Fase 3 (Dashboard+Metrics) → ~2 semanas
Sprint 9-10: Fase 4 (Automações Visual) → ~2 semanas
```

**Total estimado: 10 sprints (~10 semanas)**

### MVP Mínimo (Sprints 1-4):
- ✅ Redis + BullMQ
- ✅ WebSocket real-time
- ✅ whatsmeow bridge operacional
- ✅ Rota de incoming + outbound WhatsApp
- ✅ Handoff básico
- ✅ 1 agente IA funcional no WhatsApp

---

## 7. MELHORIAS DE LAYOUT (JÁ APLICADAS)

### Problemas Corrigidos
| Arquivo | Antes | Depois |
|---------|-------|--------|
| `AppLayout.tsx:217` | `max-w-7xl mx-auto` | `max-w-[1600px] mx-auto` |
| `Inbox.tsx:70` | `-mx-4 lg:mx-0` | removido (layout respeita container) |
| `CRM.tsx:116` | `-mx-4 lg:mx-0 px-4 lg:px-0` | removido |

### Resultado
- Container mais largo (1600px em vez de 1280px)
- Margens consistentes entre todas as páginas
- Fim dos hacks de margem negativa
- Melhor aproveitamento horizontal em telas wide
