import { Queue, Worker, Job, type JobsOptions } from "bullmq";
import { processIncomingMessage, sendViaChannel } from "./message-pipeline.ts";
import { executeLLM } from "./providers.ts";
import { emitToConversation } from "./socket.ts";
import { logger } from "./logger.ts";
import prisma from "./prisma.ts";
import { incrementMessagesProcessed } from "./metrics.ts";

const REDIS_URL = process.env.REDIS_URL || "";

const connection = {
  url: REDIS_URL,
};

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
};

let messageQueue: Queue | null = null;
let llmQueue: Queue | null = null;
let outgoingQueue: Queue | null = null;
let dialerQueue: Queue | null = null;
const workers: Worker[] = [];

function getQueues() {
  if (!REDIS_URL) return null;
  messageQueue ||= new Queue("messages", {
    connection,
    defaultJobOptions,
  });
  llmQueue ||= new Queue("llm", {
    connection,
    defaultJobOptions: { ...defaultJobOptions, attempts: 2, backoff: { type: "exponential", delay: 5000 } },
  });
  outgoingQueue ||= new Queue("outgoing", {
    connection,
    defaultJobOptions,
  });
  dialerQueue ||= new Queue("dialer", {
    connection,
    defaultJobOptions: { ...defaultJobOptions, attempts: 1, removeOnComplete: 100, removeOnFail: 50 },
  });
  return { messageQueue, llmQueue, outgoingQueue, dialerQueue };
}

export async function addMessageJob(data: {
  type: "incoming" | "llm" | "outgoing" | "handoff"
  conversationId: string
  messageId?: string
  tenantId: string
  agentId?: string
  content?: string
  channel?: string
  metadata?: any
}) {
  if (!process.env.REDIS_URL) {
    if (data.type === "incoming") {
      return processIncomingMessage({
        tenantId: data.tenantId,
        conversationId: data.conversationId,
        messageId: data.messageId,
      });
    }
    if (data.type === "outgoing") {
      const conversation = await prisma.conversation.findFirst({
        where: { id: data.conversationId, tenantId: data.tenantId },
        include: {
          channelInstance: true,
          contact: { include: { identities: true } },
          messages: { orderBy: { sentAt: "asc" }, take: 30 },
        },
      });
      if (!conversation) return { processed: false, reason: "Conversa nao encontrada" };
      return sendViaChannel(conversation, data.content || "", {
        mediaUrl: data.metadata?.mediaUrl,
        mediaType: data.metadata?.messageType,
        mediaMimeType: data.metadata?.mediaMimeType,
        mediaName: data.metadata?.mediaName,
      });
    }
    return { processed: false, reason: "Redis nao configurado para este tipo de job" };
  }

  const queues = getQueues();
  if (!queues) {
    return { processed: false, reason: "Redis nao configurado" };
  }

  const queueMap = {
    incoming: queues.messageQueue,
    llm: queues.llmQueue,
    outgoing: queues.outgoingQueue,
    handoff: queues.messageQueue,
  };

  const queue = queueMap[data.type];
  return queue.add(data.type, data, {
    priority: data.type === "incoming" ? 1 : data.type === "outgoing" ? 2 : 3,
  });
}

export function setupWorkers() {
  if (!REDIS_URL) {
    logger.info("[Queue] Redis not configured, workers disabled");
    return;
  }

  const msgWorker = new Worker("messages", async (job: Job) => {
    logger.info(`[Queue] Processing message job: ${job.id} (${job.data.type})`);
    if (job.data.type === "incoming") {
      return processIncomingMessage({
        tenantId: job.data.tenantId,
        conversationId: job.data.conversationId,
        messageId: job.data.messageId,
      });
    }
    return { processed: true, jobId: job.id };
  }, { connection, concurrency: 5 });
  workers.push(msgWorker);

  const llmWorker = new Worker("llm", async (job: Job) => {
    logger.info(`[Queue] Processing LLM job: ${job.id}`);
    const { agentId, conversationId, content } = job.data;
    if (!agentId || !conversationId || !content) {
      throw new Error("Dados insuficientes para execucao LLM");
    }

    const agent = await prisma.aiAgent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error("Agente nao encontrado");

    const providerConfig = {
      provider: agent.modelProvider as any,
      model: agent.modelName,
      temperature: agent.temperature ?? 0.7,
      systemPrompt: agent.basePrompt,
    };

    const result = await executeLLM(providerConfig, content);
    incrementMessagesProcessed();

    const answer = await prisma.message.create({
      data: {
        tenantId: job.data.tenantId,
        conversationId,
        senderType: "agent",
        senderId: agentId,
        channel: "whatsapp",
        messageType: "text",
        content: result.text,
        sentAt: new Date(),
      },
    });

    emitToConversation(conversationId, "message:new", {
      conversationId,
      message: answer,
    });

    return { processed: true, jobId: job.id, messageId: answer.id };
  }, { connection, concurrency: 3 });
  workers.push(llmWorker);

  const dialerWorker = new Worker("dialer", async (job: Job) => {
    logger.info(`[Queue] Processing dialer job: ${job.id} (${job.data.type})`);
    if (job.data.type === "process") {
      const { processCampaign, queueNextBatch } = await import("./dialer.ts");
      const result = await processCampaign(job.data.campaignId as string);
      if (result.nextBatch) {
        await queueNextBatch(job.data.campaignId as string, 3000);
      }
      return result;
    }
    return { processed: true, jobId: job.id };
  }, { connection, concurrency: 2 });
  workers.push(dialerWorker);

  const outgoingWorker = new Worker("outgoing", async (job: Job) => {
    logger.info(`[Queue] Processing outgoing job: ${job.id}`);
    const { conversationId, content, channel, mediaUrl, mediaType, caption, metadata } = job.data;

    const getBridgeHeaders = () => ({
      "Content-Type": "application/json",
      ...(process.env.WHATSMEOW_BRIDGE_SECRET ? { Authorization: `Bearer ${process.env.WHATSMEOW_BRIDGE_SECRET}` } : {}),
    } as Record<string, string>);

    const isLidJid = (value?: string | null) => /@lid$/i.test(String(value || ""));
    const phoneToWhatsAppJid = (value?: string | null) => {
      const phone = String(value || "").replace(/\D/g, "");
      return phone.length >= 10 ? `${phone}@s.whatsapp.net` : null;
    };

    const getRemoteJid = (conv: any) => {
      const messageWithRemote = conv.messages
        ?.slice()
        .reverse()
        .find((message: any) => message.metadata?.remoteJid || message.metadata?.chatJid);
      const metadata = messageWithRemote?.metadata || {};
      const remoteJid = metadata.chatPhoneJid
        || metadata.senderPhoneJid
        || (!isLidJid(metadata.remoteJid) ? metadata.remoteJid : null)
        || (!isLidJid(metadata.chatJid) ? metadata.chatJid : null);
      const identityJid = conv.contact?.identities
        ?.find((i: any) => i.provider === "whatsmeow" && !isLidJid(i.externalId))?.externalId;
      const fallbackLid = metadata.remoteJid
        || metadata.chatJid
        || conv.contact?.identities?.find((i: any) => i.provider === "whatsmeow")?.externalId;
      return remoteJid
        || identityJid
        || phoneToWhatsAppJid(conv.contact?.phone)
        || fallbackLid;
    };

    const effectiveMediaUrl = mediaUrl || metadata?.mediaUrl;
    const effectiveMediaType = mediaType || metadata?.messageType;
    const effectiveChannel = channel || "whatsmeow";

    if (effectiveChannel === "whatsmeow") {
      const bridgeUrl = (process.env.WHATSMEOW_BRIDGE_URL || "").replace(/\/$/, "");
      if (!bridgeUrl) throw new Error("WHATSMEOW_BRIDGE_URL nao configurado");

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          contact: { include: { identities: true } },
          messages: { orderBy: { sentAt: "asc" }, take: 30 },
        },
      });
      if (!conversation) throw new Error("Conversa nao encontrada");

      const remoteJid = getRemoteJid(conversation);
      if (!remoteJid) throw new Error("Destino nao encontrado");

      let endpoint = "/send";
      let body: any = { to: remoteJid, text: content, conversationId };

      if (effectiveMediaUrl) {
        endpoint = "/send/media";
        body = {
          to: remoteJid,
          mediaUrl: effectiveMediaUrl,
          mediaType: effectiveMediaType || metadata?.mediaMimeType?.split("/")?.[0] || "document",
          caption: caption || content,
          fileName: job.data.fileName || metadata?.mediaName,
          conversationId,
        };
      }

      const response = await fetch(`${bridgeUrl}${endpoint}`, {
        method: "POST",
        headers: getBridgeHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as any).error || `Falha ao enviar: ${response.status}`);
      }
    } else if (effectiveChannel === "wahaplus") {
      const wahaplusUrl = (process.env.WAHAPLUS_URL || "http://wahaplus:3000").replace(/\/$/, "");
      if (!wahaplusUrl) throw new Error("WAHAPLUS_URL nao configurado");

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          channelInstance: true,
          contact: { include: { identities: true } },
          messages: { orderBy: { sentAt: "asc" }, take: 30 },
        },
      });
      if (!conversation) throw new Error("Conversa nao encontrada");

      const instanceConfig = (conversation.channelInstance?.config || {}) as any;
      const session = instanceConfig.sessionName || instanceConfig.sessionId || conversation.channelInstance?.name || "default";
      const phoneDigits = String(conversation.contact?.phone || "").replace(/\D/g, "");
      const chatId = conversation.contact?.identities?.find((i: any) => i.provider === "wahaplus")?.externalId
        || (phoneDigits.length >= 10 ? `${phoneDigits}@c.us` : null);
      if (!chatId) throw new Error("Destino nao encontrado");

      if (effectiveMediaUrl) {
        const response = await fetch(`${wahaplusUrl}/api/sendFile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session,
            chatId,
            file: effectiveMediaUrl,
            caption: caption || content,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error((err as any).error || `Falha ao enviar midia: ${response.status}`);
        }
      } else {
        const response = await fetch(`${wahaplusUrl}/api/sendText`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session, chatId, text: content }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error((err as any).error || `Falha ao enviar: ${response.status}`);
        }
      }
    }

    return { processed: true, jobId: job.id };
  }, { connection, concurrency: 5 });
  workers.push(outgoingWorker);

  logger.info("[Queue] Workers initialized");
}

export async function addJob(
  queueName: "dialer",
  jobType: string,
  data: Record<string, unknown>,
  opts?: { delay?: number; priority?: number },
) {
  if (!process.env.REDIS_URL) {
    if (queueName === "dialer" && jobType === "process") {
      const { processCampaign } = await import("./dialer.ts");
      return processCampaign(data.campaignId as string);
    }
    return null;
  }

  const queues = getQueues();
  if (!queues) return null;

  const queueMap: Record<string, Queue> = {
    dialer: queues.dialerQueue!,
  };

  const queue = queueMap[queueName];
  if (!queue) throw new Error(`Queue ${queueName} not found`);

  const jobOpts: JobsOptions = {};
  if (opts?.delay) jobOpts.delay = opts.delay;
  if (opts?.priority) jobOpts.priority = opts.priority;

  return queue.add(jobType, data, jobOpts);
}

export async function shutdownQueues() {
  await Promise.all(workers.map((w) => w.close()));
  if (messageQueue) await messageQueue.close();
  if (llmQueue) await llmQueue.close();
  if (outgoingQueue) await outgoingQueue.close();
  if (dialerQueue) await dialerQueue.close();
}
