import prisma from "./prisma.ts";
import { executeLLM, SEGMENT_PROMPTS } from "./providers.ts";
import { LLMConfig, AgentSegment, Message } from "../../src/types/index.ts";

interface AgentExecutionResult {
  response: string
  agentId: string
  agentName: string
  metadata: {
    model: string
    provider: string
    tokensUsed: number
  }
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
  return {
    ...defaults,
    ...rest,
    ...(llmConfig ? {
      modelProvider: llmConfig.provider,
      modelName: llmConfig.model,
      basePrompt: llmConfig.systemPrompt,
      temperature: llmConfig.temperature ?? 0.7,
    } : {}),
    channels: channels ?? (llmConfig ? ["web"] : undefined),
    tags: tags ?? [],
    basePrompt: rest.basePrompt || llmConfig?.systemPrompt,
  };
}

export async function getAllAgents(tenantId?: string) {
  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  const agents = await prisma.aiAgent.findMany({ where, orderBy: { createdAt: "desc" } });
  return agents.map(toAgentResponse);
}

export async function getAgent(id: string) {
  const agent = await prisma.aiAgent.findUnique({ where: { id } });
  return toAgentResponse(agent);
}

export async function createAgent(data: any) {
  const input = fromAgentInput(data);
  const agent = await prisma.aiAgent.create({ data: input });
  return toAgentResponse(agent);
}

export async function updateAgent(id: string, data: any) {
  const input = fromAgentInput(data);
  const agent = await prisma.aiAgent.update({ where: { id }, data: input });
  return toAgentResponse(agent);
}

export async function deleteAgent(id: string) {
  try {
    await prisma.aiAgent.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function executeAgent(
  agent: any,
  userMessage: string,
  conversationHistory?: Message[]
): Promise<AgentExecutionResult> {
  const llmConfig: LLMConfig = agent.llmConfig || {
    provider: agent.modelProvider as any,
    model: agent.modelName,
    temperature: agent.temperature ?? 0.7,
    systemPrompt: agent.basePrompt,
  };

  const contextPrompt = buildAgentPrompt(agent, conversationHistory);
  const response = await executeLLM(llmConfig, userMessage, contextPrompt);

  return {
    response: response.text,
    agentId: agent.id,
    agentName: agent.name,
    metadata: {
      model: llmConfig.model,
      provider: llmConfig.provider,
      tokensUsed: (response.usage?.promptTokens ?? 0) + (response.usage?.completionTokens ?? 0),
    },
  };
}

function buildAgentPrompt(agent: any, history?: Message[]): string {
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

  return parts.join("\n");
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
