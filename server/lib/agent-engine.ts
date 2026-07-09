import prisma from "./prisma.ts";
import { executeAgentTool, type AgentToolName } from "./agent-tools.ts";
import { executeLLM, SEGMENT_PROMPTS } from "./providers.ts";
import { searchKnowledgeBaseDetailed } from "./knowledge-base.ts";
import { LLMConfig, AgentSegment, Message } from "../../src/types/index.ts";

interface AgentExecutionResult {
  response: string
  agentId: string
  agentName: string
  metadata: {
    model: string
    provider: string
    tokensUsed: number
    toolCalls?: any[]
  }
}

export interface AgentRuntimeContext {
  tenantId?: string
  contactId?: string | null
  conversationId?: string | null
  userId?: string
}

export function toAgentResponse(agent: any) {
  if (!agent) return null;
  return {
    ...agent,
    llmConfig: {
      provider: agent.modelProvider,
      model: agent.modelName,
      systemPrompt: agent.basePrompt,
      temperature: agent.temperature ?? 0.7,
    },
    channels: typeof agent.channels === "string" ? JSON.parse(agent.channels) : (agent.channels ?? []),
    tags: typeof agent.tags === "string" ? JSON.parse(agent.tags) : (agent.tags ?? []),
    createdAt: agent.createdAt instanceof Date ? agent.createdAt.toISOString() : agent.createdAt,
    updatedAt: agent.updatedAt instanceof Date ? agent.updatedAt.toISOString() : agent.updatedAt,
  };
}

function fromAgentInput(body: any, defaults: Record<string, any> = {}) {
  const { llmConfig, channels, tags, ...rest } = body;
  const input: any = {
    ...defaults,
    ...rest,
    ...(llmConfig ? {
      modelProvider: llmConfig.provider,
      modelName: llmConfig.model,
      basePrompt: llmConfig.systemPrompt,
      temperature: llmConfig.temperature ?? 0.7,
    } : {}),
    basePrompt: rest.basePrompt || llmConfig?.systemPrompt,
  };
  if (channels !== undefined) input.channels = channels;
  if (tags !== undefined) input.tags = tags;
  if (llmConfig && channels === undefined && defaults.channels !== undefined) input.channels = defaults.channels;
  if (tags === undefined && defaults.tags !== undefined) input.tags = defaults.tags;
  if (input.basePrompt === undefined) delete input.basePrompt;
  return input;
}

export async function getAllAgents(tenantId?: string) {
  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  const agents = await prisma.aiAgent.findMany({ where, orderBy: { createdAt: "desc" } });
  return agents.map(toAgentResponse);
}

export async function getAgent(id: string, tenantId?: string) {
  const agent = tenantId
    ? await prisma.aiAgent.findFirst({ where: { id, tenantId } })
    : await prisma.aiAgent.findUnique({ where: { id } });
  return toAgentResponse(agent);
}

export async function createAgent(data: any) {
  const input = fromAgentInput(data, { channels: ["web"], tags: [] });
  const agent = await prisma.aiAgent.create({ data: input });
  return toAgentResponse(agent);
}

export async function updateAgent(id: string, data: any, tenantId?: string) {
  const input = fromAgentInput(data);
  const existing = tenantId
    ? await prisma.aiAgent.findFirst({ where: { id, tenantId }, select: { id: true } })
    : await prisma.aiAgent.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;
  const agent = await prisma.aiAgent.update({ where: { id: existing.id }, data: input });
  return toAgentResponse(agent);
}

export async function deleteAgent(id: string, tenantId?: string) {
  try {
    const existing = tenantId
      ? await prisma.aiAgent.findFirst({ where: { id, tenantId }, select: { id: true } })
      : await prisma.aiAgent.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return false;
    await prisma.aiAgent.delete({ where: { id: existing.id } });
    return true;
  } catch {
    return false;
  }
}

export async function executeAgent(
  agent: any,
  userMessage: string,
  conversationHistory?: Message[],
  runtimeContext?: AgentRuntimeContext,
): Promise<AgentExecutionResult> {
  const llmConfig: LLMConfig = agent.llmConfig || {
    provider: agent.modelProvider as any,
    model: agent.modelName,
    temperature: agent.temperature ?? 0.7,
    systemPrompt: agent.basePrompt,
  };

  const contextPrompt = await buildAgentPrompt(agent, conversationHistory, userMessage);
  const response = await executeLLM(llmConfig, userMessage, contextPrompt);
  const toolCalls = await executeToolCallsFromResponse(agent, response.text, runtimeContext);
  let finalText = stripToolCalls(response.text).trim();
  if (toolCalls.length > 0) {
    const toolSummary = toolCalls
      .map((call) => `${call.name}: ${call.result.ok ? "ok" : call.result.error}`)
      .join("; ");
    finalText = finalText || `Acao executada: ${toolSummary}`;
  }

  return {
    response: finalText,
    agentId: agent.id,
    agentName: agent.name,
    metadata: {
      model: llmConfig.model,
      provider: llmConfig.provider,
      tokensUsed: (response.usage?.promptTokens ?? 0) + (response.usage?.completionTokens ?? 0),
      toolCalls,
    },
  };
}

async function buildAgentPrompt(agent: any, history?: Message[], userMessage?: string): Promise<string> {
  const parts: string[] = [];
  const systemPrompt = agent.llmConfig?.systemPrompt || agent.basePrompt;

  if (systemPrompt) {
    parts.push(systemPrompt);
  }

  const segmentPrompt = (SEGMENT_PROMPTS as any)[agent.segment];
  if (segmentPrompt) {
    parts.push(`[Segmento: ${agent.segment.toUpperCase()}] ${segmentPrompt}`);
  }

  parts.push(`Você é o agente "${agent.name}". ${agent.description || ""}`);

  if (history && history.length > 0) {
    const recentHistory = history.slice(-10);
    parts.push("Histórico da conversa:");
    recentHistory.forEach((msg) => {
      const prefix = msg.role === "user" ? "Usuário" : msg.agentId === agent.id ? agent.name : "Outro agente";
      parts.push(`${prefix}: ${msg.content}`);
    });
  }

  if (agent.knowledgeBaseId && userMessage) {
    const snippets = await searchKnowledgeBaseDetailed(agent.knowledgeBaseId, userMessage, 4);
    if (snippets.length > 0) {
      parts.push("Base de conhecimento relevante:");
      snippets.forEach((snippet, index) => {
        parts.push(`[Fonte ${index + 1}: ${snippet.documentName}] ${snippet.text}`);
      });
      parts.push("Use a base de conhecimento acima quando for relevante. Se ela nao cobrir a pergunta, diga isso e siga as regras do agente.");
    }
  }

  const rules = typeof agent.handoffRules === "string" ? JSON.parse(agent.handoffRules || "{}") : (agent.handoffRules || {});
  const allowedTools = Array.isArray(rules.allowedTools) ? rules.allowedTools : [];
  if (allowedTools.length > 0) {
    parts.push(`Ferramentas permitidas: ${allowedTools.join(", ")}.`);
    parts.push(`Para executar uma ferramenta, inclua exatamente uma linha no formato: [TOOL_CALL {"name":"nome_da_ferramenta","args":{}}]. Use ferramentas apenas quando necessario e nunca invente campos obrigatorios.`);
  }

  return parts.join("\n");
}

function stripToolCalls(text: string) {
  return text.replace(/\[TOOL_CALL\s+\{[\s\S]*?\}\]/g, "").trim();
}

function extractToolCalls(text: string): { name: AgentToolName; args: Record<string, any> }[] {
  const calls: { name: AgentToolName; args: Record<string, any> }[] = [];
  const regex = /\[TOOL_CALL\s+(\{[\s\S]*?\})\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed?.name) calls.push({ name: parsed.name, args: parsed.args || {} });
    } catch {
    }
  }
  return calls.slice(0, 3);
}

async function executeToolCallsFromResponse(agent: any, text: string, runtimeContext?: AgentRuntimeContext) {
  const rules = typeof agent.handoffRules === "string" ? JSON.parse(agent.handoffRules || "{}") : (agent.handoffRules || {});
  const allowedTools = new Set(Array.isArray(rules.allowedTools) ? rules.allowedTools : []);
  if (!runtimeContext?.tenantId || allowedTools.size === 0) return [];

  const calls = extractToolCalls(text).filter((call) => allowedTools.has(call.name));
  const results = [];
  for (const call of calls) {
    const result = await executeAgentTool({
      tenantId: runtimeContext.tenantId,
      userId: runtimeContext.userId,
      contactId: runtimeContext.contactId,
      conversationId: runtimeContext.conversationId,
      aiAgentId: agent.id,
      name: call.name,
      args: call.args,
    });
    results.push({ name: call.name, args: call.args, result });
  }
  return results;
}

export async function getPublishedAgents() {
  return prisma.aiAgent.findMany({ where: { enabled: true }, orderBy: { createdAt: "desc" } });
}

export async function getAgentsBySegment(segment: string) {
  return prisma.aiAgent.findMany({ where: { enabled: true, segment }, orderBy: { createdAt: "desc" } });
}

export async function getTopRatedAgents(limit = 6) {
  const all = await prisma.aiAgent.findMany({ where: { enabled: true } });
  return all
    .sort((a: any, b: any) => (b as any).rating - (a as any).rating)
    .slice(0, limit);
}

export async function getMostInstalledAgents(limit = 6) {
  const all = await prisma.aiAgent.findMany({ where: { enabled: true } });
  return all
    .sort((a: any, b: any) => (b as any).installs - (a as any).installs)
    .slice(0, limit);
}

export async function getOrCreateConversation(id: string, agentId: string, contactName: string, tenantId?: string) {
  const existing = await prisma.conversation.findUnique({ where: { id } });
  if (existing) return existing;

  const tid = tenantId || "seed-tenant";

  return prisma.conversation.create({
    data: {
      id,
      channel: "web",
      status: "active",
      contact: {
        create: {
          name: contactName,
          tenant: { connect: { id: tid } },
        },
      },
      channelInstance: {
        create: {
          name: "web",
          status: "active",
          channel: { create: { name: "web", provider: "web", tenant: { connect: { id: tid } } } },
        },
      },
      tenant: { connect: { id: tid } },
    },
  });
}
