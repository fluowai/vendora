import prisma from "./prisma.ts";
import { executeAgent, getAgent } from "./agent-engine.ts";
import { applySchedulingTool } from "./calendar.ts";
import { checkHandoff, routeMessage } from "./intent-router.ts";
import { emitToConversation, emitToTenant } from "./socket.ts";

function getWhatsmeowBridgeUrl() {
  return (process.env.WHATSMEOW_BRIDGE_URL || "").replace(/\/$/, "");
}

function mapMessage(message: any) {
  return {
    id: message.id,
    senderType: message.senderType,
    senderId: message.senderId,
    role: message.senderType === "contact" ? "user" : message.senderType,
    channel: message.channel,
    messageType: message.messageType,
    content: message.content,
    metadata: message.metadata,
    sentAt: message.sentAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    createdAt: message.createdAt,
  };
}

function fallbackAgentResponse(input: {
  agentName?: string
  toolContext?: string | null
  error?: string
}) {
  if (input.toolContext?.includes("horario reservado com sucesso")) {
    const match = input.toolContext.match(/para ([^.]+)\./);
    return `Perfeito, seu agendamento ficou reservado para ${match?.[1] || "o horario solicitado"}.`;
  }
  if (input.toolContext?.includes("Ofereca estas alternativas")) {
    return input.toolContext
      .replace("Ferramenta de agenda: ", "")
      .replace("Ofereca", "Posso oferecer");
  }
  if (input.toolContext?.includes("Ofereca estes horarios")) {
    return input.toolContext
      .replace("Ferramenta de agenda: ", "")
      .replace("Ofereca", "Tenho");
  }
  return `Recebi sua mensagem. ${input.agentName ? `${input.agentName} vai continuar esse atendimento.` : "Vou continuar esse atendimento."}`;
}

async function sendViaChannel(conversation: any, content: string) {
  if (conversation.channel !== "whatsmeow") {
    return { skipped: true, reason: "Canal sem envio externo configurado" };
  }

  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    return { skipped: true, reason: "WHATSMEOW_BRIDGE_URL nao configurado" };
  }

  const remoteJid = conversation.messages?.[0]?.metadata?.remoteJid
    || conversation.contact?.identities?.find((identity: any) => identity.provider === "whatsmeow")?.externalId
    || conversation.contact?.phone;
  if (!remoteJid) {
    return { skipped: true, reason: "Destino WhatsApp nao encontrado" };
  }

  const response = await fetch(`${bridgeUrl}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.WHATSMEOW_BRIDGE_SECRET ? { Authorization: `Bearer ${process.env.WHATSMEOW_BRIDGE_SECRET}` } : {}),
    },
    body: JSON.stringify({
      to: remoteJid,
      text: content,
      conversationId: conversation.id,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Falha ao enviar WhatsApp: ${response.status}`);
  }
  return data;
}

export async function processIncomingMessage(input: {
  tenantId: string
  conversationId: string
  messageId?: string
}) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: input.conversationId,
      tenantId: input.tenantId,
    },
    include: {
      contact: { include: { identities: true } },
      messages: { orderBy: { sentAt: "asc" }, take: 30 },
    },
  });

  if (!conversation || !conversation.aiEnabled) {
    return { skipped: true, reason: "Conversa inexistente ou IA desabilitada" };
  }

  const incoming = input.messageId
    ? conversation.messages.find((message) => message.id === input.messageId)
    : conversation.messages.filter((message) => message.senderType === "contact").at(-1);
  if (!incoming || incoming.senderType !== "contact" || !incoming.content) {
    return { skipped: true, reason: "Mensagem de entrada nao encontrada" };
  }

  const route = await routeMessage(input.tenantId, incoming.content, conversation.id);
  if (route.needsHuman || !route.agentId) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { aiEnabled: false, status: "pending_human" },
    });
    emitToConversation(conversation.id, "conversation:handoff", {
      conversationId: conversation.id,
      reason: route.reason,
    });
    return { handoff: true, reason: route.reason };
  }

  const agent = await getAgent(route.agentId);
  if (!agent) return { skipped: true, reason: "Agente roteado nao encontrado" };

  const scheduling = await applySchedulingTool({
    tenantId: input.tenantId,
    message: incoming.content,
    contactId: conversation.contactId,
    conversationId: conversation.id,
    aiAgentId: agent.id,
  });

  const history = conversation.messages.slice(-12).map((message: any) => ({
    id: message.id,
    role: message.senderType === "contact" ? "user" : "assistant",
    content: message.content,
    agentId: message.senderType === "agent" ? message.senderId : undefined,
  }));

  let responseText = "";
  let llmError: string | null = null;
  try {
    const messageForAgent = scheduling?.context
      ? `${incoming.content}\n\n${scheduling.context}`
      : incoming.content;
    const result = await executeAgent(agent, messageForAgent, history as any);
    responseText = result.response.trim();
  } catch (error: any) {
    llmError = error.message || "Erro ao executar IA";
    responseText = fallbackAgentResponse({
      agentName: agent.name,
      toolContext: scheduling?.context,
      error: llmError,
    });
  }

  const handoff = await checkHandoff(agent.id, `${incoming.content}\n${responseText}`);
  if (handoff.needsHandoff) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { aiEnabled: false, status: "pending_human", departmentId: handoff.departmentId },
    });
  }

  const now = new Date();
  const answer = await prisma.message.create({
    data: {
      tenantId: input.tenantId,
      conversationId: conversation.id,
      senderType: "agent",
      senderId: agent.id,
      channel: conversation.channel,
      messageType: "text",
      content: responseText,
      metadata: {
        route: { ...route },
        scheduling: scheduling
          ? {
              action: scheduling.action,
              appointmentId: scheduling.appointment?.id || null,
            }
          : null,
        llmError,
        handoff: handoff.needsHandoff ? { ...handoff } : null,
      } as any,
      sentAt: now,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now },
  });

  const mapped = mapMessage(answer);
  emitToConversation(conversation.id, "message:new", {
    conversationId: conversation.id,
    message: mapped,
  });
  emitToTenant(input.tenantId, "conversation:updated", {
    conversationId: conversation.id,
    lastMessage: responseText,
    lastMessageAt: now,
  });

  let delivery = null;
  try {
    delivery = await sendViaChannel(conversation, responseText);
  } catch (error: any) {
    delivery = { error: error.message || "Falha ao enviar resposta" };
  }

  return {
    processed: true,
    conversationId: conversation.id,
    messageId: answer.id,
    agentId: agent.id,
    schedulingAction: scheduling?.action || null,
    delivery,
  };
}
