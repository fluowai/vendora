import prisma from "./prisma.ts";
import { logger } from "./logger.ts";
import { emitToTenant } from "./socket.ts";
import { normalizePhoneForCall } from "./phone.ts";
import { getDefaultVoiceGateway } from "./voice-gateway.ts";

const DIALER_RATE = parseInt(process.env.DIALER_CALLS_PER_MINUTE || "10", 10);
const MIN_INTERVAL_MS = Math.max(60000 / DIALER_RATE, 1000);

interface DialerResult {
  campaignId: string
  processed: number
  nextBatch: boolean
}

function isWithinSchedule(campaign: { scheduleStart?: Date | null; scheduleEnd?: Date | null }): boolean {
  const now = new Date();
  if (campaign.scheduleStart && now < campaign.scheduleStart) return false;
  if (campaign.scheduleEnd && now > campaign.scheduleEnd) return false;
  return true;
}

export async function processCampaign(campaignId: string): Promise<DialerResult> {
  const campaign = await prisma.dialingCampaign.findUnique({
    where: { id: campaignId },
    include: { tenant: true },
  });
  if (!campaign) throw new Error(`Campanha ${campaignId} não encontrada`);
  if (campaign.status !== "active") return { campaignId, processed: 0, nextBatch: false };
  if (!isWithinSchedule(campaign)) {
    await pauseCampaign(campaignId, "fora do horário agendado");
    return { campaignId, processed: 0, nextBatch: false };
  }

  const sessionId = campaign.sessionId || process.env.DIALER_DEFAULT_SESSION_ID;
  if (!sessionId) {
    logger.warn("[Dialer] sessionId nao configurado", { campaignId });
    return { campaignId, processed: 0, nextBatch: false };
  }
  const voiceGateway = getDefaultVoiceGateway();

  const pendingContacts = await prisma.campaignContact.findMany({
    where: {
      campaignId,
      status: "pending",
      phone: { not: "" },
    },
    take: Math.max(1, Math.floor(DIALER_RATE / 2)),
    orderBy: { createdAt: "asc" },
  });

  if (pendingContacts.length === 0) {
    await prisma.dialingCampaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
    emitToTenant(campaign.tenantId, "dialer:campaign-updated", {
      campaignId,
      status: "completed",
    });
    return { campaignId, processed: 0, nextBatch: false };
  }

  let processed = 0;
  for (const contact of pendingContacts) {
    const attempt = await createAttempt(campaign, contact);
    if (!attempt) continue;

    try {
      const phone = normalizePhoneForCall(contact.phone);
      if (!phone) {
        await failAttempt(attempt.id, "telefone invalido");
        processed++;
        continue;
      }
      const data = await voiceGateway.startCall({
        sessionId,
        phone,
        record: true,
      });
      const callId = data?.call?.callId;

      await prisma.callAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "ringing",
          sessionId,
          callId: callId || null,
          startedAt: new Date(),
        },
      });

      await onCallInitiated(campaign, contact, callId);
      processed++;
      await sleep(MIN_INTERVAL_MS);
    } catch (err: any) {
      await failAttempt(attempt.id, err.message);
      processed++;
    }
  }

  await prisma.dialingCampaign.update({
    where: { id: campaignId },
    data: { calledCount: { increment: processed } },
  });

  return { campaignId, processed, nextBatch: true };
}

async function createAttempt(
  campaign: { id: string; maxAttempts: number; tenantId: string },
  contact: { id: string; campaignId: string; phone: string },
) {
  const lastAttempt = await prisma.callAttempt.findFirst({
    where: { campaignId: campaign.id, contactId: contact.id },
    orderBy: { attempt: "desc" },
  });

  const attemptNumber = (lastAttempt?.attempt || 0) + 1;
  if (attemptNumber > campaign.maxAttempts) {
    await prisma.campaignContact.update({
      where: { id: contact.id },
      data: { status: "failed" },
    });
    return null;
  }

  return prisma.callAttempt.create({
    data: {
      campaignId: campaign.id,
      contactId: contact.id,
      attempt: attemptNumber,
      status: "pending",
      direction: "outbound",
    },
  });
}

async function onCallInitiated(
  campaign: { id: string; tenantId: string; agentId?: string | null },
  contact: { id: string; phone: string; name?: string | null; campaignId: string; contactId?: string | null },
  callId?: string,
) {
  await prisma.campaignContact.update({
    where: { id: contact.id },
    data: { status: "called" },
  });
}

async function failAttempt(attemptId: string, errorMessage: string) {
  await prisma.callAttempt.update({
    where: { id: attemptId },
    data: { status: "failed", errorMessage, endedAt: new Date() },
  });
}

async function pauseCampaign(campaignId: string, reason: string) {
  await prisma.dialingCampaign.update({
    where: { id: campaignId },
    data: { status: "paused" },
  });
}

export async function markCallAttemptResult(
  callId: string,
  result: { status: string; duration?: number; recordingUrl?: string },
) {
  const attempt = await prisma.callAttempt.findFirst({
    where: { callId },
    include: { campaign: true, campaignContact: true },
  });
  if (!attempt) return;

  const endedAt = new Date();
  await prisma.callAttempt.update({
    where: { id: attempt.id },
    data: {
      status: result.status,
      duration: result.duration || null,
      recordingUrl: result.recordingUrl || null,
      endedAt,
      result: getResultLabel(result.status),
    },
  });

  const contactStatus = result.status === "answered" ? "answered" : "called";
  await prisma.campaignContact.update({
    where: { id: attempt.campaignContact.id },
    data: { status: contactStatus },
  });

  if (result.status === "answered") {
    await prisma.dialingCampaign.update({
      where: { id: attempt.campaignId },
      data: { answeredCount: { increment: 1 }, successCount: { increment: 1 } },
    });

    const campaign = await prisma.dialingCampaign.findUnique({ where: { id: attempt.campaignId } });
    if (campaign) {
      emitToTenant(campaign.tenantId, "dialer:call-answered", {
        campaignId: attempt.campaignId,
        contactId: attempt.campaignContact.id,
        phone: attempt.campaignContact.phone,
        callId,
      });
    }
  }

  emitToTenant(attempt.campaign.tenantId, "dialer:attempt-updated", {
    campaignId: attempt.campaignId,
    attemptId: attempt.id,
    status: result.status,
  });
}

function getResultLabel(status: string): string {
  const map: Record<string, string> = {
    answered: "Atendida",
    no_answer: "Não atendeu",
    busy: "Ocupado",
    failed: "Falha técnica",
    ringing: "Chamando",
  };
  return map[status] || status;
}

export async function queueNextBatch(campaignId: string, delayMs = 1000) {
  const campaign = await prisma.dialingCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "active") return;

  const remaining = await prisma.campaignContact.count({
    where: { campaignId, status: "pending" },
  });
  if (remaining === 0) {
    await prisma.dialingCampaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
    if (campaign) {
      emitToTenant(campaign.tenantId, "dialer:campaign-updated", {
        campaignId,
        status: "completed",
      });
    }
    return;
  }

  if (process.env.REDIS_URL) {
    const { addJob } = await import("./queue.ts");
    await addJob("dialer", "process", { campaignId }, { delay: delayMs });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
