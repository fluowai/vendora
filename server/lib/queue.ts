import { Queue, Worker, Job } from "bullmq";
import { processIncomingMessage } from "./message-pipeline.ts";

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
  return { messageQueue, llmQueue, outgoingQueue };
}

export async function addMessageJob(data: {
  type: "incoming" | "llm" | "outgoing" | "handoff"
  conversationId: string
  messageId?: string
  tenantId: string
  agentId?: string
  content?: string
}) {
  if (!process.env.REDIS_URL) {
    if (data.type === "incoming") {
      return processIncomingMessage({
        tenantId: data.tenantId,
        conversationId: data.conversationId,
        messageId: data.messageId,
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
    console.log("[Queue] Redis not configured, workers disabled");
    return;
  }

  new Worker("messages", async (job: Job) => {
    console.log(`[Queue] Processing message job: ${job.id} (${job.data.type})`);
    if (job.data.type === "incoming") {
      return processIncomingMessage({
        tenantId: job.data.tenantId,
        conversationId: job.data.conversationId,
        messageId: job.data.messageId,
      });
    }
    return { processed: true, jobId: job.id };
  }, { connection, concurrency: 5 });

  new Worker("llm", async (job: Job) => {
    console.log(`[Queue] Processing LLM job: ${job.id}`);
    return { processed: true, jobId: job.id };
  }, { connection, concurrency: 3 });

  new Worker("outgoing", async (job: Job) => {
    console.log(`[Queue] Processing outgoing job: ${job.id}`);
    return { processed: true, jobId: job.id };
  }, { connection, concurrency: 5 });

  console.log("[Queue] Workers initialized");
}
