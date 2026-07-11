import prisma from "./prisma.ts";
import { executeAgent, getAgent } from "./agent-engine.ts";
import { applySchedulingTool } from "./calendar.ts";
import { checkHandoff, routeMessage } from "./intent-router.ts";
import { orchestrateWithAgents } from "./orchestrator.ts";
import { executeFlow, findActiveMessageFlow, findWaitingRun } from "./flow-engine.ts";
import { emitToConversation, emitToTenant } from "./socket.ts";
import { getWahaplusCandidateUrls } from "./wahaplus-client.ts";

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
    mediaUrl: message.mediaUrl,
    mediaMimeType: message.mediaMimeType,
    mediaName: message.mediaName,
    mediaSize: message.mediaSize,
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

function isLlmConfigurationError(message?: string | null) {
  const text = String(message || "").toLowerCase();
  return text.includes("api key not configured")
    || text.includes("permission_denied")
    || text.includes("unregistered callers")
    || text.includes("unauthorized")
    || text.includes("invalid api key")
    || text.includes("401")
    || text.includes("403");
}

function getBridgeHeaders() {
  return {
    "Content-Type": "application/json",
    ...(process.env.WHATSMEOW_BRIDGE_SECRET ? { Authorization: `Bearer ${process.env.WHATSMEOW_BRIDGE_SECRET}` } : {}),
  } as Record<string, string>;
}

function isLidJid(value?: string | null) {
  return /@lid$/i.test(String(value || ""));
}

function phoneToWhatsAppJid(value?: string | null) {
  const phone = String(value || "").replace(/\D/g, "");
  return phone.length >= 10 ? `${phone}@s.whatsapp.net` : null;
}

function phoneToWahaChatId(value?: string | null) {
  const phone = String(value || "").replace(/\D/g, "");
  return phone.length >= 10 ? `${phone}@c.us` : null;
}

function getRemoteJid(conversation: any): string | null {
  const messageWithRemote = conversation.messages
    ?.slice()
    .reverse()
    .find((message: any) => message.metadata?.remoteJid || message.metadata?.chatJid);
  const metadata = messageWithRemote?.metadata || {};
  const remoteJid = metadata.chatPhoneJid
    || metadata.senderPhoneJid
    || (!isLidJid(metadata.remoteJid) ? metadata.remoteJid : null)
    || (!isLidJid(metadata.chatJid) ? metadata.chatJid : null);
  const identityJid = conversation.contact?.identities
    ?.find((identity: any) => identity.provider === "whatsmeow" && !isLidJid(identity.externalId))?.externalId;
  const fallbackLid = metadata.remoteJid
    || metadata.chatJid
    || conversation.contact?.identities?.find((identity: any) => identity.provider === "whatsmeow")?.externalId;
  return remoteJid
    || identityJid
    || phoneToWhatsAppJid(conversation.contact?.phone)
    || fallbackLid
    || null;
}

function getWahaplusChatId(conversation: any): string | null {
  const messageWithRemote = conversation.messages
    ?.slice()
    .reverse()
    .find((message: any) => message.metadata?.chatId || message.metadata?.remoteJid || message.metadata?.chatJid);
  const metadata = messageWithRemote?.metadata || {};
  return metadata.chatId
    || metadata.remoteJid
    || metadata.chatJid
    || conversation.contact?.identities?.find((identity: any) => identity.provider === "wahaplus")?.externalId
    || phoneToWahaChatId(conversation.contact?.phone)
    || conversation.contact?.phone
    || null;
}

function getWahaplusSession(conversation: any): string {
  const config = (conversation.channelInstance?.config || {}) as any;
  return config.sessionName || config.sessionId || conversation.channelInstance?.name || "default";
}

async function sendTypingIndicator(remoteJid: string, state: string) {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) return;

  try {
    await fetch(`${bridgeUrl}/typing`, {
      method: "POST",
      headers: getBridgeHeaders(),
      body: JSON.stringify({ to: remoteJid, state }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
  }
}

export async function sendViaChannel(conversation: any, content: string, media?: {
  mediaUrl?: string
  mediaType?: string
  mediaMimeType?: string
  mediaName?: string
}) {
  if (conversation.channel !== "whatsmeow" && conversation.channel !== "wahaplus") {
    return { skipped: true, reason: "Canal sem envio externo configurado" };
  }

  if (conversation.channel === "wahaplus") {
    const candidateUrls = getWahaplusCandidateUrls();
    if (candidateUrls.length === 0) {
      return { skipped: true, reason: "WAHAPLUS_URL nao configurado" };
    }

    const session = getWahaplusSession(conversation);
    const chatId = getWahaplusChatId(conversation);
    if (!chatId) {
      return { skipped: true, reason: "Destino WAHA+ nao encontrado" };
    }

    const hasMedia = !!media?.mediaUrl;
    let lastError: any = null;
    for (const baseUrl of candidateUrls) {
      try {
        const response = await fetch(`${baseUrl}${hasMedia ? "/api/sendFile" : "/api/sendText"}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hasMedia
            ? {
                session,
                chatId,
                file: media.mediaUrl,
                caption: content,
              }
            : { session, chatId, text: content }),
          signal: AbortSignal.timeout(7000),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || data.message || `Falha ao enviar WAHA+: ${response.status}`);
        }
        return data;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("WAHA+ indisponivel");
  }

  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    return { skipped: true, reason: "WHATSMEOW_BRIDGE_URL nao configurado" };
  }

  const remoteJid = getRemoteJid(conversation);
  if (!remoteJid) {
    return { skipped: true, reason: "Destino WhatsApp nao encontrado" };
  }

  const hasMedia = !!media?.mediaUrl;
  const response = await fetch(`${bridgeUrl}${hasMedia ? "/send/media" : "/send"}`, {
    method: "POST",
    headers: getBridgeHeaders(),
    body: JSON.stringify(hasMedia
      ? {
          to: remoteJid,
          caption: content,
          mediaUrl: media.mediaUrl,
          mediaType: media.mediaType || media.mediaMimeType?.split("/")[0] || "document",
          fileName: media.mediaName,
          conversationId: conversation.id,
        }
      : {
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
      channelInstance: true,
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

  const remoteJid = getRemoteJid(conversation);
  if (remoteJid && conversation.channel === "whatsmeow") {
    void sendTypingIndicator(remoteJid, "typing");
  }

  const waitingFlowRun = await findWaitingRun(input.tenantId, conversation.id);
  const activeFlow = waitingFlowRun
    ? null
    : await findActiveMessageFlow(input.tenantId, conversation.channel);
  if (waitingFlowRun || activeFlow) {
    try {
      const flowResult = await executeFlow({
        tenantId: input.tenantId,
        runId: waitingFlowRun?.id,
        flowId: activeFlow?.id,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        input: incoming.content,
      });

      const deliveries = [];
      for (const output of flowResult.outputs || []) {
        if (output.content) {
          deliveries.push(await sendViaChannel(conversation, output.content).catch((error: any) => ({
            error: error.message || "Falha ao enviar resposta do fluxo",
          })));
        }
      }
      if (remoteJid && conversation.channel === "whatsmeow") {
        void sendTypingIndicator(remoteJid, "paused");
      }
      return {
        processed: true,
        flow: true,
        conversationId: conversation.id,
        runId: flowResult.runId,
        status: flowResult.status,
        deliveries,
      };
    } catch (error: any) {
      emitToConversation(conversation.id, "flow:error", {
        conversationId: conversation.id,
        error: error.message || "Erro ao executar fluxo",
      });
    }
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

  const agent = await getAgent(route.agentId, input.tenantId);
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
    const rules = agent.handoffRules || {};
    const supportAgentIds = Array.isArray(rules.supportAgentIds) ? rules.supportAgentIds : [];
    const runtimeContext = {
      tenantId: input.tenantId,
      contactId: conversation.contactId,
      conversationId: conversation.id,
    };
    if (supportAgentIds.length > 0) {
      const result = await orchestrateWithAgents(agent.id, messageForAgent, supportAgentIds, history as any, runtimeContext);
      responseText = result.finalResponse.trim();
    } else {
      const result = await executeAgent(agent, messageForAgent, history as any, runtimeContext);
      responseText = result.response.trim();
    }
  } catch (error: any) {
    llmError = error.message || "Erro ao executar IA";
    if (isLlmConfigurationError(llmError) && !scheduling?.context) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { aiEnabled: false, status: "pending_human" },
      });
      emitToConversation(conversation.id, "conversation:handoff", {
        conversationId: conversation.id,
        reason: "LLM provider not configured",
        llmError,
        agentId: agent.id,
      });
      if (remoteJid && conversation.channel === "whatsmeow") {
        void sendTypingIndicator(remoteJid, "paused");
      }
      return {
        handoff: true,
        reason: "LLM provider not configured",
        conversationId: conversation.id,
        agentId: agent.id,
        llmError,
      };
    }
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
    if (remoteJid && conversation.channel === "whatsmeow") {
      void sendTypingIndicator(remoteJid, "paused");
    }
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
