import prisma from "./prisma.ts";
import { createAppointment, listAvailableSlots } from "./calendar.ts";
import { searchKnowledgeBase } from "./knowledge-base.ts";
import { logAudit } from "./audit.ts";

export type AgentToolName =
  | "update_contact"
  | "create_ticket"
  | "create_deal"
  | "create_appointment"
  | "list_available_slots"
  | "search_knowledge"
  | "webhook";

export type AgentToolInput = {
  tenantId: string
  userId?: string
  contactId?: string | null
  conversationId?: string | null
  aiAgentId?: string | null
  name: AgentToolName
  args: Record<string, any>
}

export type AgentToolResult = {
  tool: AgentToolName
  ok: boolean
  result?: any
  error?: string
  requiresApproval?: boolean
}

const SAFE_WEBHOOK_METHODS = new Set(["POST", "PUT", "PATCH"]);

async function resolveContact(input: AgentToolInput) {
  if (input.contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: input.contactId, tenantId: input.tenantId },
    });
    if (contact) return contact;
  }

  if (input.conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: input.conversationId, tenantId: input.tenantId },
      include: { contact: true },
    });
    if (conversation?.contact) return conversation.contact;
  }

  return null;
}

async function getDefaultFunnelAndStage(tenantId: string) {
  const existing = await prisma.funnel.findFirst({
    where: { tenantId },
    include: { stages: { orderBy: { order: "asc" } } },
    orderBy: { id: "asc" },
  });
  if (existing?.stages[0]) return { funnel: existing, stage: existing.stages[0] };

  const funnel = await prisma.funnel.create({
    data: {
      tenantId,
      name: "Pipeline principal",
      stages: {
        create: [
          { name: "Novo lead", order: 1 },
          { name: "Qualificado", order: 2 },
          { name: "Proposta", order: 3 },
        ],
      },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  return { funnel, stage: funnel.stages[0] };
}

async function recordAudit(input: AgentToolInput, entityType: string, entityId: string, metadata?: Record<string, any>) {
  await logAudit({
    tenantId: input.tenantId,
    userId: input.userId,
    action: `agent_tool.${input.name}`,
    entityType,
    entityId,
    metadata: {
      conversationId: input.conversationId,
      aiAgentId: input.aiAgentId,
      args: input.args,
      ...metadata,
    },
  });
}

async function updateContact(input: AgentToolInput): Promise<AgentToolResult> {
  const contact = await resolveContact(input);
  if (!contact) return { tool: input.name, ok: false, error: "Contato nao encontrado" };

  const allowed = ["name", "email", "phone", "document", "companyName", "city", "state", "source", "score", "status"];
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (input.args[key] !== undefined) data[key] = input.args[key];
  }
  if (Object.keys(data).length === 0) return { tool: input.name, ok: false, error: "Nenhum campo permitido informado" };

  const updated = await prisma.contact.update({
    where: { id: contact.id },
    data,
  });
  await recordAudit(input, "Contact", updated.id);
  return { tool: input.name, ok: true, result: updated };
}

async function createTicketTool(input: AgentToolInput): Promise<AgentToolResult> {
  const contact = await resolveContact(input);
  if (!contact) return { tool: input.name, ok: false, error: "Contato obrigatorio para criar ticket" };

  const ticket = await prisma.ticket.create({
    data: {
      tenantId: input.tenantId,
      contactId: contact.id,
      conversationId: input.conversationId || null,
      title: String(input.args.title || "Atendimento gerado por IA").slice(0, 200),
      description: String(input.args.description || input.args.reason || "Ticket criado automaticamente por agente IA"),
      status: "aberto",
      priority: input.args.priority || "normal",
      departmentId: input.args.departmentId || null,
      assignedUserId: input.args.assignedUserId || null,
    },
  });
  await recordAudit(input, "Ticket", ticket.id);
  return { tool: input.name, ok: true, result: ticket };
}

async function createDealTool(input: AgentToolInput): Promise<AgentToolResult> {
  const contact = await resolveContact(input);
  if (!contact) return { tool: input.name, ok: false, error: "Contato obrigatorio para criar negocio" };
  const defaults = await getDefaultFunnelAndStage(input.tenantId);

  const deal = await prisma.deal.create({
    data: {
      tenantId: input.tenantId,
      contactId: contact.id,
      conversationId: input.conversationId || null,
      funnelId: input.args.funnelId || defaults.funnel.id,
      stageId: input.args.stageId || defaults.stage.id,
      title: String(input.args.title || `Oportunidade - ${contact.name}`).slice(0, 200),
      value: typeof input.args.value === "number" ? input.args.value : null,
      status: "active",
      source: input.args.source || "agent",
      temperature: input.args.temperature || "morno",
      score: typeof input.args.score === "number" ? input.args.score : null,
      assignedUserId: input.args.assignedUserId || null,
      expectedCloseDate: input.args.expectedCloseDate ? new Date(input.args.expectedCloseDate) : null,
    },
  });
  await recordAudit(input, "Deal", deal.id);
  return { tool: input.name, ok: true, result: deal };
}

async function createAppointmentTool(input: AgentToolInput): Promise<AgentToolResult> {
  const startsAt = input.args.startsAt ? new Date(input.args.startsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    return { tool: input.name, ok: false, error: "startsAt valido e obrigatorio" };
  }

  const appointment = await createAppointment({
    tenantId: input.tenantId,
    calendarId: input.args.calendarId,
    contactId: input.contactId || null,
    conversationId: input.conversationId || null,
    aiAgentId: input.aiAgentId || null,
    title: input.args.title || "Atendimento agendado",
    description: input.args.description,
    startsAt,
    durationMinutes: input.args.durationMinutes,
    source: "agent-tool",
    metadata: { tool: input.name, args: input.args },
  });
  await recordAudit(input, "Appointment", appointment.id);
  return { tool: input.name, ok: true, result: appointment };
}

async function listSlotsTool(input: AgentToolInput): Promise<AgentToolResult> {
  const slots = await listAvailableSlots(input.tenantId, {
    from: input.args.from ? new Date(input.args.from) : undefined,
    days: input.args.days,
    limit: input.args.limit,
  });
  return {
    tool: input.name,
    ok: true,
    result: {
      calendarId: slots.calendar.id,
      slots: slots.slots.map((slot) => slot.toISOString()),
    },
  };
}

async function searchKnowledgeTool(input: AgentToolInput): Promise<AgentToolResult> {
  const kbId = input.args.knowledgeBaseId;
  const query = input.args.query;
  if (!kbId || !query) return { tool: input.name, ok: false, error: "knowledgeBaseId e query sao obrigatorios" };
  const kb = await prisma.knowledgeBase.findFirst({ where: { id: kbId, tenantId: input.tenantId } });
  if (!kb) return { tool: input.name, ok: false, error: "Base de conhecimento nao encontrada" };
  const results = await searchKnowledgeBase(kb.id, String(query), input.args.maxResults || 5);
  return { tool: input.name, ok: true, result: { results } };
}

async function webhookTool(input: AgentToolInput): Promise<AgentToolResult> {
  const url = String(input.args.url || "");
  if (!/^https?:\/\//i.test(url)) return { tool: input.name, ok: false, error: "URL de webhook invalida" };
  if (input.args.requiresApproval !== false) {
    return { tool: input.name, ok: false, requiresApproval: true, error: "Webhook requer aprovacao explicita" };
  }

  const method = String(input.args.method || "POST").toUpperCase();
  if (!SAFE_WEBHOOK_METHODS.has(method)) return { tool: input.name, ok: false, error: "Metodo de webhook nao permitido" };
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input.args.body || {}),
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.text();
  await recordAudit(input, "Webhook", url, { status: response.status });
  return {
    tool: input.name,
    ok: response.ok,
    result: { status: response.status, body: body.slice(0, 2000) },
    error: response.ok ? undefined : `Webhook retornou ${response.status}`,
  };
}

export async function executeAgentTool(input: AgentToolInput): Promise<AgentToolResult> {
  try {
    switch (input.name) {
      case "update_contact":
        return updateContact(input);
      case "create_ticket":
        return createTicketTool(input);
      case "create_deal":
        return createDealTool(input);
      case "create_appointment":
        return createAppointmentTool(input);
      case "list_available_slots":
        return listSlotsTool(input);
      case "search_knowledge":
        return searchKnowledgeTool(input);
      case "webhook":
        return webhookTool(input);
      default:
        return { tool: input.name, ok: false, error: "Ferramenta nao suportada" };
    }
  } catch (error: any) {
    return { tool: input.name, ok: false, error: error.message || "Erro ao executar ferramenta" };
  }
}

export const AVAILABLE_AGENT_TOOLS = [
  { name: "update_contact", label: "Atualizar contato", risk: "low" },
  { name: "create_ticket", label: "Criar ticket", risk: "medium" },
  { name: "create_deal", label: "Criar negocio", risk: "medium" },
  { name: "create_appointment", label: "Criar agendamento", risk: "medium" },
  { name: "list_available_slots", label: "Listar horarios", risk: "low" },
  { name: "search_knowledge", label: "Buscar conhecimento", risk: "low" },
  { name: "webhook", label: "Chamar webhook", risk: "high" },
];
