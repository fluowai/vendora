import prisma from "./prisma.ts";
import { executeLLM } from "./providers.ts";

interface RouteResult {
  agentId: string | null
  agentName: string
  confidence: number
  needsHuman: boolean
  reason: string
}

function parseRules(rules: any) {
  if (typeof rules !== "string") return rules || {};
  try {
    return JSON.parse(rules);
  } catch {
    return {};
  }
}

function arrayRule(value: any): string[] {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim())
    : [];
}

export async function routeMessage(tenantId: string, message: string, conversationId?: string): Promise<RouteResult> {
  const [allAgents, conversation] = await Promise.all([
    prisma.aiAgent.findMany({
      where: { tenantId, enabled: true, status: "active" },
    }),
    conversationId
      ? prisma.conversation.findFirst({
          where: { id: conversationId, tenantId },
          include: { messages: { take: 5, orderBy: { sentAt: "desc" } } },
        })
      : null,
  ]);

  const isWhatsAppConversation = conversation
    ? ["whatsmeow", "whatsapp_cloud"].includes(conversation.channel)
    : false;

  const agents = isWhatsAppConversation
    ? allAgents.filter((agent: any) => {
        const rules = parseRules(agent.handoffRules);
        const instanceIds = arrayRule(rules.whatsappInstanceIds);
        return !!conversation.channelInstanceId && instanceIds.includes(conversation.channelInstanceId);
      })
    : allAgents;

  if (agents.length === 0) {
    return {
      agentId: null,
      agentName: "Nenhum agente disponivel",
      confidence: 0,
      needsHuman: true,
      reason: isWhatsAppConversation
        ? "Nenhum agente ativo vinculado a esta instancia de WhatsApp"
        : "Sem agentes ativos no tenant",
    };
  }

  if (agents.length === 1) {
    return { agentId: agents[0].id, agentName: agents[0].name, confidence: 1, needsHuman: false, reason: "Unico agente disponivel" };
  }

  const historyContext = conversation?.messages
    ?.map((m) => `${m.senderType === "contact" ? "Cliente" : "Agente"}: ${m.content}`)
    .join("\n") || "";

  const agentList = agents
    .map((a) => `- ${a.id}: ${a.name} (segmento: ${a.segment}, descricao: ${a.description || "sem descricao"})`)
    .join("\n");

  const prompt = `Voce e um roteador de mensagens. Analise a mensagem do cliente e decida qual agente e o mais adequado para responder.

Mensagem do cliente: "${message}"

Historico recente:
${historyContext || "(sem historico)"}

Agentes disponiveis:
${agentList}

Responda APENAS com um JSON neste formato:
{
  "agentId": "id-do-agente-escolhido",
  "confidence": 0.0-1.0,
  "reason": "motivo resumido da escolha"
}

Se a mensagem indicar insatisfacao, raiva, ou necessidade de atendimento humano urgente, inclua "needsHuman": true no JSON.`;

  try {
    const result = await executeLLM(
      { provider: "gemini", model: "gemini-3-flash-preview", temperature: 0.2, maxTokens: 256 },
      prompt,
    );

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { agentId: agents[0].id, agentName: agents[0].name, confidence: 0.5, needsHuman: false, reason: "Fallback: primeiro agente" };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const matchedAgent = agents.find((a) => a.id === parsed.agentId);

    if (!matchedAgent) {
      return { agentId: agents[0].id, agentName: agents[0].name, confidence: 0.5, needsHuman: false, reason: "Agente escolhido nao encontrado, fallback" };
    }

    return {
      agentId: matchedAgent.id,
      agentName: matchedAgent.name,
      confidence: parsed.confidence || 0.5,
      needsHuman: parsed.needsHuman === true,
      reason: parsed.reason || "Roteado por IA",
    };
  } catch {
    return { agentId: agents[0].id, agentName: agents[0].name, confidence: 0.5, needsHuman: false, reason: "Fallback: erro no roteador" };
  }
}

export async function checkHandoff(agentId: string, message: string, conversationHistory?: string): Promise<{ needsHandoff: boolean; reason: string; departmentId?: string }> {
  const agent = await prisma.aiAgent.findUnique({ where: { id: agentId } });
  if (!agent?.handoffRules) return { needsHandoff: false, reason: "Sem regras de handoff" };

  const rules = parseRules(agent.handoffRules);

  if (rules.enabled === false) return { needsHandoff: false, reason: "Handoff desabilitado" };

  const keywords = rules.keywords || rules.escalationKeywords || [];
  const lowerMessage = message.toLowerCase();
  const keywordMatch = keywords.some((kw: string) => lowerMessage.includes(kw.toLowerCase()));

  if (keywordMatch) {
    return { needsHandoff: true, reason: "Palavra-chave detectada", departmentId: rules.departmentId || undefined };
  }

  if (rules.sentimento === "negativo") {
    try {
      const sentimentResult = await executeLLM(
        { provider: "gemini", model: "gemini-3-flash-preview", temperature: 0.1, maxTokens: 50 },
        `Classifique o sentimento desta mensagem como "positivo", "neutro" ou "negativo". Responda apenas uma palavra.\n\nMensagem: "${message}"`,
      );
      const sentiment = sentimentResult.text.toLowerCase().trim();

      if (sentiment.includes("negativo")) {
        return { needsHandoff: true, reason: "Sentimento negativo detectado", departmentId: rules.departmentId || undefined };
      }
    } catch {}
  }

  const maxRetries = rules.maxRetries || 3;
  if (conversationHistory) {
    const agentFailures = (conversationHistory.match(/nao (posso|consigo|entendi|sei)/gi) || []).length;
    if (agentFailures >= maxRetries) {
      return { needsHandoff: true, reason: `Agente falhou ${agentFailures}x consecutivas`, departmentId: rules.departmentId || undefined };
    }
  }

  return { needsHandoff: false, reason: "Sem necessidade de handoff" };
}
