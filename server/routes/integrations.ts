import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { webhookLimiter, whatsappSendLimiter, whatsappMediaLimiter } from "../middleware/rate-limit.ts";
import { addMessageJob } from "../lib/queue.ts";
import { logger } from "../lib/logger.ts";
import { uploadBuffer } from "../lib/storage.ts";
import { emitToConversation, emitToTenant } from "../lib/socket.ts";

const router = Router();

function getWebhookSecret() {
  return process.env.CHATWOOT_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "";
}

function getWhatsmeowWebhookSecret() {
  return process.env.WHATSMEOW_BRIDGE_SECRET || process.env.WEBHOOK_SECRET || "";
}

function normalizeServiceUrl(value?: string) {
  return (value || "").replace(/\/$/, "").trim();
}

function getWhatsmeowCandidateUrls() {
  return Array.from(new Set([
    normalizeServiceUrl(process.env.WHATSMEOW_BRIDGE_URL),
    "http://whatsmeow-bridge:4000",
    "http://vendedoraai_whatsmeow-bridge:4000",
    "http://localhost:4000",
  ].filter(Boolean)));
}

function getWhatsmeowBridgeUrl() {
  return getWhatsmeowCandidateUrls()[0] || "";
}

function getWhatsmeowHeaders() {
  return {
    "Content-Type": "application/json",
    ...(process.env.WHATSMEOW_BRIDGE_SECRET ? { Authorization: `Bearer ${process.env.WHATSMEOW_BRIDGE_SECRET}` } : {}),
  } as Record<string, string>;
}

async function fetchWhatsmeowBridgeJson(path: string, init?: RequestInit, timeoutMs = 5000) {
  const bridgeUrls = getWhatsmeowCandidateUrls();
  if (bridgeUrls.length === 0) {
    return null;
  }

  let lastError: any = null;
  for (const bridgeUrl of bridgeUrls) {
    try {
      const response = await fetch(`${bridgeUrl}${path}`, {
        ...init,
        headers: {
          ...getWhatsmeowHeaders(),
          ...(init?.headers || {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await response.json().catch(() => ({}));
      return { baseUrl: bridgeUrl, response, data };
    } catch (error: any) {
      lastError = error;
    }
  }

  throw lastError || new Error("whatsmeow-bridge indisponivel");
}

function getWahaplusUrl() {
  return (process.env.WAHAPLUS_URL || "").replace(/\/$/, "");
}

function getWahaplusCandidateUrls() {
  const configured = getWahaplusUrl();
  return Array.from(new Set([
    configured,
    "http://vendedoraai_wahaplus:3000",
    "http://wahaplus:3000",
  ].filter(Boolean)));
}

async function readResponseBody(response: globalThis.Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }
  if (contentType.startsWith("image/")) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { image: `data:${contentType.split(";")[0]};base64,${buffer.toString("base64")}` };
  }
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchWahaplus(path: string, init?: RequestInit, timeoutMs = 7000) {
  const urls = getWahaplusCandidateUrls();
  if (urls.length === 0) {
    throw new Error("WAHAPLUS_URL nao configurado");
  }

  let lastError: any = null;
  for (const baseUrl of urls) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const data = await readResponseBody(response);
      return { baseUrl, response, data };
    } catch (error: any) {
      lastError = error;
    }
  }

  throw lastError || new Error("WAHA+ indisponivel");
}

async function fetchFirstWahaplus(paths: string[], init?: RequestInit, timeoutMs = 7000) {
  let last: any = null;
  for (const path of paths) {
    const result = await fetchWahaplus(path, init, timeoutMs).catch((error) => {
      last = error;
      return null;
    });
    if (result && result.response.status !== 404) return result;
    last = result;
  }
  if (last?.response) return last;
  throw last || new Error("WAHA+ indisponivel");
}

function whatsmeowBridgeError(error?: any) {
  const message = error?.message || String(error || "");
  if (!message || message === "fetch failed" || message.includes("ECONNREFUSED") || message.includes("timed out")) {
    return `Bridge WhatsApp offline. Verifique o container whatsmeow-bridge na porta 4000. Tentativas: ${getWhatsmeowCandidateUrls().join(", ")}.`;
  }
  return message;
}

function whatsmeowIdentityFromStatus(data: any) {
  const jid = asString(data?.jid);
  const phone = asString(data?.phone) || jidToPhone(jid);
  const pushName = asString(data?.pushName || data?.businessName);
  const businessName = asString(data?.businessName);
  const avatarUrl = asString(data?.avatarUrl);
  return { jid, phone, pushName, businessName, avatarUrl };
}

function assertWebhookSecret(req: Request, res: Response, expected = getWebhookSecret()): boolean {
  if (!expected) return true;

  const provided = req.headers["x-vendaora-signature"]
    || req.headers["x-chatwoot-webhook-secret"]
    || req.headers.authorization?.replace("Bearer ", "");

  if (provided !== expected) {
    res.status(401).json({ error: "Webhook não autorizado" });
    return false;
  }

  return true;
}

function mapRealtimeMessage(message: any) {
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

function mapRealtimeConversation(conversation: any, contact: any, channelInstance: any, message: any) {
  const metadata = (message?.metadata || {}) as any;
  return {
    id: conversation.id,
    contactId: conversation.contactId,
    name: contact?.name || "Contato",
    phone: contact?.phone,
    email: contact?.email,
    avatarUrl: contact?.avatarUrl,
    pushName: contact?.pushName,
    channel: conversation.channel,
    status: conversation.status,
    aiEnabled: conversation.aiEnabled,
    priority: conversation.priority,
    assignedUser: null,
    instance: channelInstance
      ? {
          id: channelInstance.id,
          name: channelInstance.name,
          status: channelInstance.status,
          channelName: channelInstance.channel?.name,
          provider: channelInstance.channel?.provider,
        }
      : null,
    isGroup: !!metadata.isGroup,
    chatType: metadata.chatType || (metadata.isGroup ? "group" : "private"),
    remoteJid: metadata.remoteJid || metadata.chatJid || null,
    lastMessage: message?.content || "",
    lastMessageAt: conversation.lastMessageAt || message?.sentAt || conversation.createdAt,
    time: conversation.lastMessageAt || message?.sentAt || conversation.createdAt,
    unread: 0,
    slaDueAt: conversation.slaDueAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function isWhatsAppGroupJid(value: string) {
  return asString(value).toLowerCase().endsWith("@g.us");
}

function isLid(value: string) {
  return /@lid$/i.test(asString(value).trim());
}

function bareWhatsAppJid(value: string) {
  const trimmed = asString(value).trim();
  if (!trimmed || !trimmed.includes("@")) return trimmed;

  const [userPart, ...serverParts] = trimmed.split("@");
  const server = serverParts.join("@").toLowerCase();
  if (["s.whatsapp.net", "c.us", "lid"].includes(server)) {
    return `${userPart.split(/[.:]/)[0]}@${server}`;
  }
  return trimmed;
}

function jidToPhone(value: string) {
  const bare = bareWhatsAppJid(value);
  if (isLid(bare) || isWhatsAppGroupJid(bare)) return "";
  const user = bare.includes("@") ? bare.split("@")[0] : bare;
  const cleaned = user.replace(/\D/g, "");
  return cleaned.length >= 10 ? cleaned : "";
}

function normalizeWhatsAppJid(value: string) {
  const trimmed = bareWhatsAppJid(value);
  if (!trimmed || isLid(trimmed)) return "";
  if (trimmed.includes("@")) return trimmed;
  const phone = jidToPhone(trimmed);
  return phone ? `${phone}@s.whatsapp.net` : "";
}

function normalizeJidCandidate(value: string) {
  const trimmed = bareWhatsAppJid(value);
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;
  const phone = jidToPhone(trimmed);
  return phone ? `${phone}@s.whatsapp.net` : "";
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => asString(value).trim()).filter(Boolean))];
}

function firstJid(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeJidCandidate(asString(value));
    if (normalized) return normalized;
  }
  return "";
}

function firstNonLidJid(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeJidCandidate(asString(value));
    if (normalized && !isLid(normalized)) return normalized;
  }
  return "";
}

function firstLidJid(...values: unknown[]) {
  for (const value of values) {
    const normalized = normalizeJidCandidate(asString(value));
    if (normalized && isLid(normalized)) return normalized;
  }
  return "";
}

function phoneFromJids(...values: unknown[]) {
  for (const value of values) {
    const phone = jidToPhone(asString(value));
    if (phone) return phone;
  }
  return "";
}

function displayWhatsAppIdentity(input: { pushName?: string; senderName?: string; jid?: string; fallback?: string }) {
  const name = asString(input.pushName || input.senderName).trim();
  if (name && !isLid(name)) return name;
  const phone = jidToPhone(input.jid || "");
  if (phone) return phone;
  return input.fallback || "Participante";
}

function sanitizeWhatsmeowRaw(body: any) {
  if (!body || typeof body !== "object") return body;
  const media = body.media ? { ...body.media, dataBase64: undefined } : undefined;
  return { ...body, ...(media ? { media } : {}) };
}

async function persistIncomingMedia(tenantId: string, messageId: string, media: any) {
  if (!media?.dataBase64) return null;
  const mimeType = asString(media.mimetype || media.mimeType || "application/octet-stream");
  const buffer = Buffer.from(String(media.dataBase64), "base64");
  const prefix = `whatsmeow/${tenantId}/${messageId || "incoming"}`;
  const stored = await uploadBuffer(buffer, mimeType, prefix);
  return {
    url: stored.url,
    key: stored.key,
    mimeType,
    name: asString(media.fileName || media.title || `${media.type || "media"}-${messageId}`),
    size: Number(media.size || media.fileLength || buffer.length) || buffer.length,
  };
}

function stableId(...parts: string[]) {
  return parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 180);
}

async function getOrCreateProviderInstance(tenantId: string, provider: string, name: string) {
  const existing = await prisma.channelInstance.findFirst({
    where: {
      channel: { tenantId, provider },
      status: "active",
    },
    include: { channel: true },
  });

  if (existing) return existing;

  const channel = await prisma.channel.upsert({
    where: { id: stableId(tenantId, provider) },
    update: { status: "active" },
    create: {
      id: stableId(tenantId, provider),
      tenantId,
      name,
      provider,
      status: "active",
    },
  });

  return prisma.channelInstance.create({
    data: {
      channelId: channel.id,
      name: `${name} principal`,
      status: "active",
    },
    include: { channel: true },
  });
}

function isPhoneLikeLabel(value: string) {
  const trimmed = asString(value).trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 10 && digits === trimmed.replace(/\D/g, "");
}

function betterContactName(current: string | null | undefined, incoming: string | null | undefined, phone?: string | null) {
  const next = asString(incoming).trim();
  if (!next || isLid(next) || next === current) return undefined;

  const existing = asString(current).trim();
  if (!existing || existing === "Contato Chatwoot" || existing === "Contato WhatsApp") return next;
  if (phone && existing === phone) return next;
  if (isPhoneLikeLabel(existing) && !isPhoneLikeLabel(next)) return next;
  if (isPhoneLikeLabel(next) && !isPhoneLikeLabel(existing)) return undefined;
  return next;
}

async function ensureContactIdentities(input: {
  tenantId: string
  contactId: string
  channel: string
  provider: string
  externalIds: string[]
  username?: string | null
  phone?: string | null
  email?: string | null
  metadata?: any
}) {
  for (const externalId of uniqueStrings(input.externalIds)) {
    const existing = await prisma.contactIdentity.findFirst({
      where: { tenantId: input.tenantId, provider: input.provider, externalId },
      select: { id: true, contactId: true, username: true, phone: true, email: true },
    });

    if (!existing) {
      await prisma.contactIdentity.create({
        data: {
          tenantId: input.tenantId,
          contactId: input.contactId,
          channel: input.channel,
          provider: input.provider,
          externalId,
          username: input.username || null,
          phone: input.phone || null,
          email: input.email || null,
          metadata: input.metadata || {},
        },
      });
      continue;
    }

    if (
      existing.contactId !== input.contactId
      || (input.username && input.username !== existing.username)
      || (input.phone && input.phone !== existing.phone)
      || (input.email && input.email !== existing.email)
    ) {
      await prisma.contactIdentity.update({
        where: { id: existing.id },
        data: {
          contactId: input.contactId,
          ...(input.username ? { username: input.username } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.email ? { email: input.email } : {}),
          metadata: input.metadata || {},
        },
      });
    }
  }
}

async function getOrCreateContact(tenantId: string, provider: string, channel: string, externalId: string, payload: any) {
  const aliasExternalIds = uniqueStrings([
    externalId,
    ...(Array.isArray(payload?.aliasExternalIds) ? payload.aliasExternalIds : []),
  ]);
  const name = payload?.name || payload?.sender?.name || payload?.contact?.name || "Contato Chatwoot";
  const email = payload?.email || payload?.sender?.email || payload?.contact?.email;
  const phone = payload?.phone_number || payload?.phone || payload?.sender?.phone_number || payload?.contact?.phone_number;
  const pushName = payload?.pushName || null;

  const existingIdentity = aliasExternalIds.length
    ? await prisma.contactIdentity.findFirst({
        where: { tenantId, provider, OR: aliasExternalIds.map((id) => ({ externalId: id })) },
        include: { contact: true },
      })
    : null;

  if (existingIdentity?.contact) {
    const betterName = betterContactName(existingIdentity.contact.name, name, phone);
    const betterPhone = phone && phone !== existingIdentity.contact.phone ? phone : undefined;
    const avatarUrl = payload?.avatarUrl && payload.avatarUrl !== existingIdentity.contact.avatarUrl ? payload.avatarUrl : undefined;
    const betterPushName = pushName && pushName !== existingIdentity.contact.pushName ? pushName : undefined;
    const contact = betterName || betterPhone || avatarUrl || betterPushName
      ? await prisma.contact.update({
        where: { id: existingIdentity.contact.id },
        data: {
          ...(betterName ? { name: betterName } : {}),
          ...(betterPhone ? { phone: betterPhone } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
          ...(betterPushName ? { pushName: betterPushName } : {}),
        },
      })
      : existingIdentity.contact;

    await ensureContactIdentities({
      tenantId,
      contactId: contact.id,
      channel,
      provider,
      externalIds: aliasExternalIds,
      username: name,
      phone,
      email,
      metadata: payload || {},
    });
    return contact;
  }

  const existingContact = phone
    ? await prisma.contact.findFirst({ where: { tenantId, phone } })
    : null;

  if (existingContact) {
    const betterName = betterContactName(existingContact.name, name, phone);
    const avatarUrl = payload?.avatarUrl && payload.avatarUrl !== existingContact.avatarUrl ? payload.avatarUrl : undefined;
    const betterPushName = pushName && pushName !== existingContact.pushName ? pushName : undefined;
    const contact = betterName || avatarUrl || betterPushName
      ? await prisma.contact.update({
        where: { id: existingContact.id },
        data: {
          ...(betterName ? { name: betterName } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
          ...(betterPushName ? { pushName: betterPushName } : {}),
        },
      })
      : existingContact;

    await ensureContactIdentities({
      tenantId,
      contactId: contact.id,
      channel,
      provider,
      externalIds: aliasExternalIds,
      username: name,
      phone,
      email,
      metadata: payload || {},
    });
    return contact;
    }

  const contact = await prisma.contact.create({
    data: {
      tenantId,
      name,
      email,
      phone,
      source: provider,
      avatarUrl: payload?.avatarUrl || null,
      pushName: payload?.pushName || null,
    },
  });

  await ensureContactIdentities({
    tenantId,
    contactId: contact.id,
    channel,
    provider,
    externalIds: aliasExternalIds,
    username: name,
    phone,
    email,
    metadata: payload || {},
  });

  return contact;
}

async function materializeIncomingMessage(input: {
  tenantId: string
  provider: string
  providerName: string
  instanceId?: string
  externalConversationId: string
  externalConversationAliases?: string[]
  externalMessageId?: string
  contactExternalId: string
  contactPayload: any
  content: string
  senderType: string
  metadata?: any
  messageType?: string
  mediaUrl?: string | null
  mediaMimeType?: string | null
  mediaName?: string | null
  mediaSize?: number | null
}) {
  const channelInstance = input.instanceId
    ? await prisma.channelInstance.findFirst({
        where: {
          id: input.instanceId,
          status: { in: ["active", "connected"] },
          channel: { tenantId: input.tenantId, provider: input.provider },
        },
        include: { channel: true },
      })
    : await getOrCreateProviderInstance(input.tenantId, input.provider, input.providerName);

  if (!channelInstance) {
    throw new Error("Instância não encontrada para este tenant/provedor");
  }

  const contact = await getOrCreateContact(
    input.tenantId,
    input.provider,
    input.provider,
    input.contactExternalId,
    input.contactPayload,
  );
  const conversationKeys = uniqueStrings([input.externalConversationId, ...(input.externalConversationAliases || [])]);
  const candidateConversationIds = conversationKeys.map((key) => stableId(input.provider, input.tenantId, channelInstance.id, key));
  const preferredConversationId = candidateConversationIds[0]
    || stableId(input.provider, input.tenantId, channelInstance.id, input.externalConversationId);
  const now = new Date();
  const existingConversation = await prisma.conversation.findFirst({
    where: { id: { in: candidateConversationIds.length ? candidateConversationIds : [preferredConversationId] } },
    select: { id: true },
  });
  const conversationId = existingConversation?.id || preferredConversationId;

  const conversation = await prisma.conversation.upsert({
    where: { id: conversationId },
    update: {
      contactId: contact.id,
      channelInstanceId: channelInstance.id,
      channel: input.provider,
      lastMessageAt: input.content ? now : undefined,
    },
    create: {
      id: conversationId,
      tenantId: input.tenantId,
      contactId: contact.id,
      channelInstanceId: channelInstance.id,
      channel: input.provider,
      status: "active",
      aiEnabled: true,
      lastMessageAt: input.content ? now : null,
    },
  });

  let message = null;
  let isNewMessage = false;
  if (input.content) {
    const existingMessage = input.externalMessageId
      ? await prisma.message.findFirst({
          where: {
            tenantId: input.tenantId,
            conversationId: conversation.id,
            providerMessageId: input.externalMessageId,
          },
        })
      : null;

    if (existingMessage) {
      message = existingMessage;
    } else {
      message = await prisma.message.create({
        data: {
          tenantId: input.tenantId,
          conversationId: conversation.id,
          contactId: input.senderType === "contact" ? contact.id : null,
          senderType: input.senderType,
          senderId: input.senderType === "contact" ? contact.id : input.provider,
          channel: input.provider,
          providerMessageId: input.externalMessageId || null,
          messageType: input.messageType || "text",
          content: input.content,
          mediaUrl: input.mediaUrl || null,
          mediaMimeType: input.mediaMimeType || null,
          mediaName: input.mediaName || null,
          mediaSize: input.mediaSize || null,
          metadata: input.metadata || {},
          sentAt: now,
        },
      });
      isNewMessage = true;
    }
  }

  return {
    conversation,
    contact,
    channelInstance,
    message,
    isNewMessage,
    isNewConversation: !existingConversation,
  };
}

async function applyWhatsmeowReceipt(tenantId: string, body: any) {
  const messageIds: string[] = Array.isArray(body.messageIds) ? body.messageIds : [];
  const receiptType = asString(body.receiptType);

  if (messageIds.length === 0) return;

  await prisma.message.updateMany({
    where: {
      tenantId,
      providerMessageId: { in: messageIds },
    },
    data: {
      ...(receiptType === "read" || receiptType === "read-self"
        ? { readAt: new Date() }
        : { deliveredAt: new Date() }),
    },
  });
}

function emitIncomingRealtime(input: {
  tenantId: string
  conversation: any
  contact: any
  channelInstance: any
  message: any
  isNewConversation: boolean
}) {
  try {
    const realtimeMessage = mapRealtimeMessage(input.message);
    const realtimeConversation = mapRealtimeConversation(
      input.conversation,
      input.contact,
      input.channelInstance,
      input.message,
    );

    emitToConversation(input.conversation.id, "message:new", {
      conversationId: input.conversation.id,
      message: realtimeMessage,
    });

    if (input.isNewConversation) {
      emitToTenant(input.tenantId, "conversation:new", realtimeConversation);
    } else {
      emitToTenant(input.tenantId, "conversation:updated", {
        conversationId: input.conversation.id,
        lastMessage: input.message.content,
        lastMessageAt: input.message.sentAt,
        time: input.message.sentAt,
        conversation: realtimeConversation,
      });
    }
  } catch (error) {
    logger.error("[Integrations] failed to emit realtime incoming message", { error });
  }
}

function extractChatwootPayload(body: any) {
  const message = body.message || body;
  const conversation = body.conversation || message.conversation || body;
  const contact = body.contact || conversation.contact || conversation.meta?.sender || message.sender || body.sender || {};
  const externalConversationId = asString(conversation.id || body.conversation_id || message.conversation_id);
  const externalMessageId = asString(message.id || body.message_id || body.id);
  const rawType = message.message_type ?? body.message_type;
  const incoming = rawType === 0 || rawType === "incoming" || rawType === "in";

  return {
    event: body.event || body.event_name || body.webhook_event || "message",
    externalConversationId,
    externalMessageId,
    contactExternalId: asString(contact.id || contact.identifier || contact.email || contact.phone_number || contact.phone),
    content: asString(message.content || body.content),
    senderType: incoming ? "contact" : "user",
    contact,
    conversation,
    message,
  };
}

router.post("/chatwoot/webhook", webhookLimiter, async (req: Request, res: Response) => {
  if (!assertWebhookSecret(req, res)) return;

  const tenantId = asString(req.headers["x-tenant-id"] || req.query.tenantId || req.body.tenantId || req.body.tenant_id);
  if (!tenantId) {
    res.status(400).json({ error: "tenantId obrigatório para webhook Chatwoot" });
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    res.status(404).json({ error: "Tenant não encontrado" });
    return;
  }

  const parsed = extractChatwootPayload(req.body);
  if (!parsed.externalConversationId) {
    res.status(400).json({ error: "conversation id não encontrado no payload Chatwoot" });
    return;
  }

  const { conversation, contact, channelInstance, message, isNewMessage, isNewConversation } = await materializeIncomingMessage({
    tenantId,
    provider: "chatwoot",
    providerName: "Chatwoot",
    externalConversationId: parsed.externalConversationId,
    externalMessageId: parsed.externalMessageId,
    contactExternalId: parsed.contactExternalId,
    contactPayload: parsed.contact,
    content: parsed.content,
    senderType: parsed.senderType,
    metadata: {
      event: parsed.event,
      chatwootConversationId: parsed.externalConversationId,
      raw: parsed.message,
    },
  });

  if (isNewMessage && message?.senderType === "contact") {
    emitIncomingRealtime({
      tenantId,
      conversation,
      contact,
      channelInstance,
      message,
      isNewConversation,
    });

    void addMessageJob({
      type: "incoming",
      tenantId,
      conversationId: conversation.id,
      messageId: message.id,
    }).catch((error) => logger.error("[Pipeline] chatwoot incoming failed", { error }));
  }

  res.status(202).json({
    accepted: true,
    event: parsed.event,
    conversationId: conversation.id,
    messageId: message?.id || null,
  });
});

router.get("/status", async (req: Request, res: Response) => {
  const tenantId = asString(req.headers["x-tenant-id"] || req.query.tenantId);
  const bridgeUrl = getWhatsmeowBridgeUrl();

  const channels = tenantId
    ? await prisma.channel.findMany({
        where: { tenantId },
        include: { instances: true },
        orderBy: { name: "asc" },
      })
    : [];

  res.json({
    integrations: {
      chatwoot: {
        enabled: true,
        webhookPath: "/api/integrations/chatwoot/webhook",
        requiresTenantId: true,
        secretConfigured: !!getWebhookSecret(),
      },
      whatsmeow: {
        enabled: !!bridgeUrl,
        bridgeUrl: bridgeUrl || null,
        webhookPath: "/api/integrations/whatsmeow/incoming",
        qrPath: "/api/integrations/whatsmeow/qr",
        pairCodePath: "/api/integrations/whatsmeow/pair/code",
        sendPath: "/api/integrations/whatsmeow/send",
        sendMediaPath: "/api/integrations/whatsmeow/send/media",
        typingPath: "/api/integrations/whatsmeow/typing",
        healthPath: "/api/integrations/whatsmeow/health",
        receiptPath: "/api/integrations/whatsmeow/incoming/receipt",
      },
      wahaplus: {
        enabled: !!getWahaplusUrl(),
        webhookPath: "/api/integrations/wahaplus/incoming",
        sessionsPath: "/api/integrations/wahaplus/sessions",
        sendPath: "/api/integrations/wahaplus/send",
      },
      whatsapp_cloud: {
        enabled: !!getCloudApiConfig().token && !!getCloudApiConfig().phoneNumberId,
        webhookPath: "/api/integrations/whatsapp-cloud/webhook",
        sendPath: "/api/integrations/whatsapp-cloud/send",
        templatePath: "/api/integrations/whatsapp-cloud/send/template",
        verifyTokenConfigured: !!getCloudApiConfig().verifyToken,
      },
    },
    channels,
  });
});

router.get("/connections",
  authMiddleware,
  requirePermission("channels", "manage"),
  async (req: Request, res: Response) => {
    const where = req.user!.isSuperadmin ? {} : { tenantId: req.user!.tenantId };
    const channels = await prisma.channel.findMany({
      where,
      include: { instances: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" },
    });

    res.json({
      connections: channels.flatMap((channel) => channel.instances.map((instance) => {
        const config = (instance.config || {}) as any;
        return {
          id: instance.id,
          name: instance.name,
          status: instance.status,
          config,
          webhookUrl: config.webhookUrl,
          qrPath: config.qrPath,
          statusPath: config.statusPath,
          jid: config.jid || null,
          phone: config.phone || null,
          pushName: config.pushName || null,
          businessName: config.businessName || null,
          avatarUrl: config.avatarUrl || null,
          connectedAt: config.connectedAt || null,
          lastStatusAt: config.lastStatusAt || null,
          channel: {
            id: channel.id,
            name: channel.name,
            provider: channel.provider,
            status: channel.status,
            config: channel.config,
          },
        };
      })),
    });
  }
);

router.post("/connections",
  authMiddleware,
  requirePermission("channels", "manage"),
  validate(schemas.createConnection),
  async (req: Request, res: Response) => {
    const { provider, name, config } = req.body;

    const tenantId = req.user!.tenantId;
    const channelId = stableId(tenantId, provider);
    const labels: Record<string, string> = {
      chatwoot: "Chatwoot",
      whatsmeow: "WhatsApp whatsmeow",
      whatsapp_cloud: "WhatsApp Cloud API",
      instagram: "Instagram Direct",
      web: "Web Widget",
      email: "Email",
    };

    const channel = await prisma.channel.upsert({
      where: { id: channelId },
      update: {
        name: labels[provider] || provider,
        provider,
        status: "active",
        config: config || {},
      },
      create: {
        id: channelId,
        tenantId,
        name: labels[provider] || provider,
        provider,
        status: "active",
        config: config || {},
      },
    });

    const instance = await prisma.channelInstance.create({
      data: {
        channelId: channel.id,
        name,
        status: "active",
        config: config || {},
      },
    });

    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get("host")}`;
    const instanceConfig = {
      ...(config || {}),
      webhookUrl: `${baseUrl}/api/integrations/${provider}/incoming?tenantId=${tenantId}&instanceId=${instance.id}`,
      qrPath: provider === "whatsmeow" ? `/api/integrations/whatsmeow/instances/${instance.id}/qr` : null,
      statusPath: provider === "whatsmeow" ? `/api/integrations/whatsmeow/instances/${instance.id}/status` : null,
    };

    const updatedInstance = await prisma.channelInstance.update({
      where: { id: instance.id },
      data: { config: instanceConfig },
    });

    res.status(201).json({
      connection: {
        id: updatedInstance.id,
        name: updatedInstance.name,
        status: updatedInstance.status,
        config: updatedInstance.config,
        webhookUrl: instanceConfig.webhookUrl,
        qrPath: instanceConfig.qrPath,
        statusPath: instanceConfig.statusPath,
        channel: {
          id: channel.id,
          name: channel.name,
          provider: channel.provider,
          status: channel.status,
          config: channel.config,
        },
      },
    });
  }
);

router.delete("/connections/:id",
  authMiddleware,
  requirePermission("channels", "manage"),
  async (req: Request, res: Response) => {
    const instance = await prisma.channelInstance.findFirst({
      where: {
        id: req.params.id,
        ...(req.user!.isSuperadmin ? {} : { channel: { tenantId: req.user!.tenantId } }),
      },
      include: { channel: true },
    });

    if (!instance) {
      res.status(404).json({ error: "Instancia nao encontrada" });
      return;
    }

    const conversationCount = await prisma.conversation.count({
      where: { channelInstanceId: instance.id },
    });
    const force = req.query.force === "true";
    if (conversationCount > 0 && !force) {
      res.status(409).json({
        error: "Instancia possui conversas vinculadas. Confirme a exclusao definitiva para remover a instancia.",
        summary: { conversations: conversationCount },
      });
      return;
    }

    let bridgeError: string | null = null;
    if (instance.channel.provider === "whatsmeow") {
      if (!getWhatsmeowBridgeUrl()) {
        bridgeError = "WHATSMEOW_BRIDGE_URL nao configurado";
      } else {
        try {
          await fetchWhatsmeowBridgeJson("/logout", { method: "POST" }, 4000);
        } catch (error: any) {
          bridgeError = whatsmeowBridgeError(error);
          logger.warn("[Whatsmeow] instance delete continued after bridge logout failed", {
            error,
            instanceId: instance.id,
          });
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      const conversations = await tx.conversation.findMany({
        where: { channelInstanceId: instance.id },
        select: { id: true },
      });
      const conversationIds = conversations.map((item: { id: string }) => item.id);

      if (conversationIds.length > 0) {
        await tx.flowRun.updateMany({
          where: { conversationId: { in: conversationIds } },
          data: { conversationId: null },
        });
        await tx.deal.updateMany({
          where: { conversationId: { in: conversationIds } },
          data: { conversationId: null },
        });
        await tx.ticket.updateMany({
          where: { conversationId: { in: conversationIds } },
          data: { conversationId: null },
        });
        await tx.ombudsmanCase.updateMany({
          where: { conversationId: { in: conversationIds } },
          data: { conversationId: null },
        });
        await tx.appointment.updateMany({
          where: { conversationId: { in: conversationIds } },
          data: { conversationId: null },
        });
        await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
        await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
      }

      await tx.channelInstance.delete({ where: { id: instance.id } });
    }, { maxWait: 10000, timeout: 30000 });

    res.json({
      success: true,
      bridgeAvailable: !bridgeError,
      bridgeError,
    });
  }
);

router.post("/whatsmeow/incoming", webhookLimiter, async (req: Request, res: Response) => {
  if (!assertWebhookSecret(req, res, getWhatsmeowWebhookSecret())) return;

  const tenantId = asString(req.headers["x-tenant-id"] || req.query.tenantId || req.body.tenantId || req.body.tenant_id);
  const instanceId = asString(req.headers["x-instance-id"] || req.query.instanceId || req.body.instanceId || req.body.instance_id);
  if (!tenantId) {
    res.status(400).json({ error: "tenantId obrigatório para webhook whatsmeow" });
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    res.status(404).json({ error: "Tenant não encontrado" });
    return;
  }

  if (asString(req.body.event) === "receipt") {
    await applyWhatsmeowReceipt(tenantId, req.body);
    res.status(202).json({ accepted: true, event: "receipt" });
    return;
  }

  if (!instanceId) {
    res.status(400).json({ error: "instanceId obrigatorio para webhook whatsmeow" });
    return;
  }

  const incomingInstance = await prisma.channelInstance.findFirst({
    where: {
      id: instanceId,
      status: { in: ["active", "connected"] },
      channel: { tenantId, provider: "whatsmeow" },
    },
    select: { id: true },
  });

  if (!incomingInstance) {
    res.status(404).json({ error: "Instancia whatsmeow inativa ou nao encontrada para este tenant" });
    return;
  }

  const rawFrom = asString(req.body.from || req.body.senderJid || req.body.senderPnJid || req.body.senderAltJid || req.body.sender || req.body.remoteJid || req.body.jid);
  const rawChatJid = asString(req.body.rawChatJid || req.body.chatId || req.body.remoteJid || req.body.conversationId || rawFrom);
  const rawGroupJid = firstJid(req.body.chatId, req.body.remoteJid, req.body.conversationId, rawChatJid);
  const isGroup = req.body.isGroup === true || req.body.chatType === "group" || isWhatsAppGroupJid(rawGroupJid || rawChatJid);
  const senderPhoneJid = firstNonLidJid(req.body.senderPnJid, req.body.from, req.body.senderJid, req.body.senderAltJid, req.body.sender);
  const senderLidJid = firstLidJid(req.body.senderLidJid, req.body.from, req.body.senderJid, req.body.senderAltJid, req.body.sender);
  const chatPhoneJid = isGroup
    ? ""
    : firstNonLidJid(req.body.chatPnJid, req.body.phoneJid, req.body.chatId, req.body.remoteJid, req.body.conversationId, senderPhoneJid);
  const chatLidJid = isGroup
    ? ""
    : firstLidJid(req.body.chatLidJid, req.body.chatId, req.body.remoteJid, req.body.conversationId, senderLidJid);
  const participantPhoneJid = firstNonLidJid(req.body.participantPnJid, req.body.participantJid, senderPhoneJid);
  const participantLidJid = firstLidJid(req.body.participantLidJid, req.body.participantJid, senderLidJid);
  const chatJid = isGroup ? (rawGroupJid || rawChatJid) : (chatPhoneJid || senderPhoneJid || chatLidJid || senderLidJid || rawChatJid);
  const participantJid = isGroup ? (participantPhoneJid || participantLidJid || senderPhoneJid || senderLidJid) : "";
  const from = senderPhoneJid || (!isGroup ? chatJid : participantJid) || senderLidJid || rawFrom;
  const messageId = asString(req.body.messageId || req.body.id);
  const text = asString(req.body.text || req.body.content || req.body.message?.text || req.body.message?.conversation);
  const conversationKey = chatJid;
  const hasMedia = !!req.body.hasMedia;
  const media = req.body.media || null;
  const messageType = asString(req.body.messageType || (hasMedia ? "media" : "text"));
  const chatType = isGroup ? "group" : "private";
  const senderPhone = isGroup
    ? phoneFromJids(participantPhoneJid, senderPhoneJid)
    : phoneFromJids(chatPhoneJid, senderPhoneJid, from);
  const senderDisplayName = displayWhatsAppIdentity({
    pushName: req.body.pushName,
    senderName: req.body.senderName,
    jid: senderPhoneJid || chatPhoneJid || from || participantJid,
    fallback: senderPhone || undefined,
  });
  const groupName = asString(req.body.groupName || req.body.chatName || req.body.name || "Grupo WhatsApp");
  const contactExternalId = isGroup
    ? chatJid
    : (chatPhoneJid || senderPhoneJid || chatLidJid || senderLidJid || from);
  const aliasExternalIds = isGroup
    ? uniqueStrings([chatJid, rawGroupJid, rawChatJid])
    : uniqueStrings([contactExternalId, chatPhoneJid, senderPhoneJid, chatLidJid, senderLidJid, from, rawFrom]);
  const storedMedia = hasMedia ? await persistIncomingMedia(tenantId, messageId, media).catch((error) => {
    logger.error("[Whatsmeow] failed to persist incoming media", { error });
    return null;
  }) : null;

  if (!from || !conversationKey) {
    res.status(400).json({ error: "from/remoteJid obrigatório no payload whatsmeow" });
    return;
  }

  const { conversation, contact, channelInstance, message, isNewMessage, isNewConversation } = await materializeIncomingMessage({
    tenantId,
    provider: "whatsmeow",
    providerName: "WhatsApp whatsmeow",
    instanceId,
    externalConversationId: conversationKey,
    externalConversationAliases: aliasExternalIds,
    externalMessageId: messageId,
    contactExternalId,
    contactPayload: {
      name: isGroup ? groupName : senderDisplayName,
      phone: isGroup ? null : senderPhone,
      pushName: isGroup ? null : asString(req.body.pushName || req.body.senderName || ""),
      avatarUrl: asString(req.body.avatarUrl || ""),
      aliasExternalIds,
      raw: sanitizeWhatsmeowRaw(req.body),
    },
    content: text || media?.caption || (hasMedia ? `[${messageType}]` : ""),
    senderType: "contact",
    messageType,
    mediaUrl: storedMedia?.url || null,
    mediaMimeType: storedMedia?.mimeType || media?.mimetype || null,
    mediaName: storedMedia?.name || media?.fileName || media?.title || null,
    mediaSize: storedMedia?.size || Number(media?.fileLength || 0) || null,
    metadata: {
      event: "whatsmeow.message",
      remoteJid: chatJid,
      chatJid,
      rawChatJid,
      rawGroupJid,
      chatPhoneJid,
      chatLidJid,
      senderJid: from,
      senderPhoneJid,
      senderLidJid,
      participantJid,
      participantPhoneJid,
      participantLidJid,
      senderName: senderDisplayName,
      senderPhone,
      groupName,
      isGroup,
      chatType,
      instanceId,
      hasMedia,
      media: media ? { ...media, dataBase64: undefined } : null,
      storedMedia,
      messageType,
      raw: sanitizeWhatsmeowRaw(req.body),
    },
  });

  if (isNewMessage && message?.senderType === "contact") {
    emitIncomingRealtime({
      tenantId,
      conversation,
      contact,
      channelInstance,
      message,
      isNewConversation,
    });

    void addMessageJob({
      type: "incoming",
      tenantId,
      conversationId: conversation.id,
      messageId: message.id,
    }).catch((error) => logger.error("[Pipeline] whatsmeow incoming failed", { error }));
  }

  res.status(202).json({
    accepted: true,
    conversationId: conversation.id,
    messageId: message?.id || null,
  });
});

async function assertInstanceAccess(req: Request, res: Response) {
  const instance = await prisma.channelInstance.findFirst({
    where: {
      id: req.params.id,
      channel: req.user!.isSuperadmin
        ? { provider: "whatsmeow" }
        : { tenantId: req.user!.tenantId, provider: "whatsmeow" },
    },
    include: { channel: true },
  });

  if (!instance) {
    res.status(404).json({ error: "Instância não encontrada" });
    return null;
  }

  return instance;
}

router.get("/whatsmeow/instances/:id/status",
  authMiddleware,
  requirePermission("channels", "manage"),
  async (req: Request, res: Response) => {
    const instance = await assertInstanceAccess(req, res);
    if (!instance) return;

    const bridgeUrl = getWhatsmeowBridgeUrl();
    if (!bridgeUrl) {
      res.json({ connected: false, bridgeAvailable: false, error: "WHATSMEOW_BRIDGE_URL não configurado" });
      return;
    }

    try {
      const instanceConfig = instance.config as any;
      if (instanceConfig?.webhookUrl) {
        await fetchWhatsmeowBridgeJson("/config", {
          method: "POST",
          body: JSON.stringify({ webhookUrl: instanceConfig.webhookUrl }),
        }, 3000).catch((error) => logger.warn("[Whatsmeow] failed to sync instance webhook before status", { error, instanceId: instance.id }));
      }

      const bridge = await fetchWhatsmeowBridgeJson("/status", undefined, 5000);
      const response = bridge!.response;
      const data = bridge!.data;
      const identity = whatsmeowIdentityFromStatus(data);
      const config = (instance.config || {}) as any;
      if (response.ok && data.connected && (identity.jid || identity.phone || identity.pushName || identity.avatarUrl)) {
        await prisma.channelInstance.update({
          where: { id: instance.id },
          data: {
            status: "connected",
            config: {
              ...config,
              ...identity,
              connectedAt: config.connectedAt || new Date().toISOString(),
              lastStatusAt: new Date().toISOString(),
            },
          },
        });
      }
      res.json({
        ...data,
        instanceId: instance.id,
        bridgeAvailable: response.ok,
        connected: !!data.connected,
        ...identity,
        error: response.ok ? data.error : (data.error || "Bridge WhatsApp indisponivel. Verifique o whatsmeow-bridge."),
      });
    } catch (error: any) {
      res.json({ connected: false, bridgeAvailable: false, error: whatsmeowBridgeError(error) });
    }
  }
);

router.get("/whatsmeow/instances/:id/qr",
  authMiddleware,
  requirePermission("channels", "manage"),
  async (req: Request, res: Response) => {
    const instance = await assertInstanceAccess(req, res);
    if (!instance) return;

    const bridgeUrl = getWhatsmeowBridgeUrl();
    if (!bridgeUrl) {
      res.json({ connected: false, bridgeAvailable: false, qr: null, error: "WHATSMEOW_BRIDGE_URL não configurado" });
      return;
    }

    try {
      const instanceConfig = instance.config as any;
      if (instanceConfig?.webhookUrl) {
        await fetchWhatsmeowBridgeJson("/config", {
          method: "POST",
          body: JSON.stringify({ webhookUrl: instanceConfig.webhookUrl }),
        }, 3000).catch((error) => logger.warn("[Whatsmeow] failed to sync instance webhook before qr", { error, instanceId: instance.id }));
      }
      const bridge = await fetchWhatsmeowBridgeJson("/qr", undefined, 5000);
      const response = bridge!.response;
      const data = bridge!.data;
      res.json({
        ...data,
        instanceId: instance.id,
        bridgeAvailable: response.ok,
        connected: !!data.connected,
        qr: data.qr || null,
        error: response.ok ? data.error : (data.error || "Bridge whatsmeow indisponível"),
      });
    } catch (error: any) {
      res.json({ connected: false, bridgeAvailable: false, qr: null, error: whatsmeowBridgeError(error) });
    }
  }
);

router.post("/whatsmeow/instances/:id/logout",
  authMiddleware,
  requirePermission("channels", "manage"),
  async (req: Request, res: Response) => {
    const instance = await assertInstanceAccess(req, res);
    if (!instance) return;

    const bridgeUrl = getWhatsmeowBridgeUrl();
    if (!bridgeUrl) {
      res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
      return;
    }

    try {
      const bridge = await fetchWhatsmeowBridgeJson("/logout", { method: "POST" }, 5000);
      const response = bridge!.response;
      const data = bridge!.data;

      await prisma.channelInstance.update({
        where: { id: instance.id },
        data: { status: "disconnected" },
      });

      res.json({
        ...data,
        success: true,
        connected: false,
        bridgeAvailable: response.ok,
        instanceId: instance.id,
        error: response.ok ? data.error : (data.error || "Bridge WhatsApp indisponivel. Instancia marcada como desconectada localmente."),
      });
    } catch (error: any) {
      await prisma.channelInstance.update({
        where: { id: instance.id },
        data: { status: "disconnected" },
      });
      res.json({
        success: true,
        connected: false,
        bridgeAvailable: false,
        error: whatsmeowBridgeError(error),
        instanceId: instance.id,
      });
    }
  }
);

router.get("/whatsmeow/status", async (_req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ connected: false, error: "WHATSMEOW_BRIDGE_URL não configurado" });
    return;
  }

  try {
    const bridge = await fetchWhatsmeowBridgeJson("/status");
    const response = bridge!.response;
    const data = bridge!.data;
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ connected: false, error: whatsmeowBridgeError(error) });
  }
});

router.get("/whatsmeow/qr", async (_req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
    return;
  }

  try {
    const bridge = await fetchWhatsmeowBridgeJson("/qr");
    const response = bridge!.response;
    const data = bridge!.data;
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.post("/whatsmeow/pair/code", whatsappSendLimiter, async (req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL nao configurado" });
    return;
  }

  const { phone, showPushNotification, clientType, clientDisplayName } = req.body;
  if (!phone) {
    res.status(400).json({ error: "phone obrigatorio" });
    return;
  }

  try {
    const bridge = await fetchWhatsmeowBridgeJson("/pair/code", {
      method: "POST",
      body: JSON.stringify({ phone, showPushNotification: !!showPushNotification, clientType, clientDisplayName }),
    });
    const response = bridge!.response;
    const data = bridge!.data;
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.post("/whatsmeow/send", whatsappSendLimiter, async (req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
    return;
  }

  const { to, text, conversationId } = req.body;
  if (!to || !text) {
    res.status(400).json({ error: "to e text são obrigatórios" });
    return;
  }

  try {
    const bridge = await fetchWhatsmeowBridgeJson("/send", {
      method: "POST",
      body: JSON.stringify({ to, text, conversationId }),
    });
    res.status(bridge!.response.status).json(bridge!.data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.post("/whatsmeow/send/media", whatsappMediaLimiter, async (req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
    return;
  }

  const { to, caption, mediaUrl, mediaType, fileName, conversationId } = req.body;
  if (!to || !mediaUrl) {
    res.status(400).json({ error: "to e mediaUrl são obrigatórios" });
    return;
  }

  try {
    const bridge = await fetchWhatsmeowBridgeJson("/send/media", {
      method: "POST",
      body: JSON.stringify({ to, caption, mediaUrl, mediaType, fileName, conversationId }),
    });
    res.status(bridge!.response.status).json(bridge!.data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.post("/whatsmeow/typing", async (req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
    return;
  }

  const { to, state } = req.body;
  if (!to) {
    res.status(400).json({ error: "to é obrigatório" });
    return;
  }

  try {
    const bridge = await fetchWhatsmeowBridgeJson("/typing", {
      method: "POST",
      body: JSON.stringify({ to, state: state || "typing" }),
    });
    res.status(bridge!.response.status).json(bridge!.data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.get("/whatsmeow/health", async (_req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
    return;
  }

  try {
    const bridge = await fetchWhatsmeowBridgeJson("/health");
    const response = bridge!.response;
    const data = bridge!.data;
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.post("/whatsmeow/incoming/receipt", webhookLimiter, async (req: Request, res: Response) => {
  if (!assertWebhookSecret(req, res, getWhatsmeowWebhookSecret())) return;

  const tenantId = asString(req.headers["x-tenant-id"] || req.query.tenantId || req.body.tenantId);
  if (!tenantId) {
    res.status(400).json({ error: "tenantId obrigatório" });
    return;
  }

  const event = asString(req.body.event);
  if (event !== "receipt") {
    res.status(200).json({ accepted: true });
    return;
  }

  await applyWhatsmeowReceipt(tenantId, req.body);

  res.status(202).json({ accepted: true });
});

// ============================================================
// WhatsApp Cloud API (Meta Official API)
// ============================================================

function getCloudApiConfig() {
  return {
    token: process.env.WHATSAPP_CLOUD_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    appSecret: process.env.META_APP_SECRET || "",
    verifyToken: process.env.META_VERIFY_TOKEN || "vendaora_verify",
  };
}

const CLOUD_API_BASE = "https://graph.facebook.com/v22.0";

router.get("/whatsapp-cloud/webhook", async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const config = getCloudApiConfig();

  if (mode === "subscribe" && token === config.verifyToken) {
    logger.info("[WhatsApp Cloud] Webhook verified");
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Verification failed");
  }
});

router.post("/whatsapp-cloud/webhook", webhookLimiter, async (req: Request, res: Response) => {
  const body = req.body;
  const config = getCloudApiConfig();

  if (!config.token || !config.phoneNumberId) {
    res.status(503).json({ error: "WhatsApp Cloud API não configurado" });
    return;
  }

  if (config.appSecret) {
    const signature = asString(req.headers["x-hub-signature-256"]);
    if (signature) {
      const crypto = await import("crypto");
      const expected = crypto
        .createHmac("sha256", config.appSecret)
        .update(JSON.stringify(body))
        .digest("hex");
      if (signature !== `sha256=${expected}`) {
        res.status(401).json({ error: "Invalid signature" });
        return;
      }
    }
  }

  const entries = body?.entry || [];
  for (const entry of entries) {
    const changes = entry?.changes || [];
    for (const change of changes) {
      const value = change?.value || {};
      const messages = value?.messages || [];
      const metadata = value?.metadata || {};
      const contacts = value?.contacts || [];

      const phoneNumberId = metadata?.phone_number_id;
      const displayPhoneNumber = metadata?.display_phone_number;

      for (const msg of messages) {
        const from = msg?.from || "";
        const msgId = msg?.id || "";
        const msgType = msg?.type || "text";
        let text = "";
        let mediaInfo: any = null;

        if (msgType === "text") {
          text = msg?.text?.body || "";
        } else if (msgType === "image") {
          text = `[image: ${msg?.image?.caption || ""}]`;
          mediaInfo = { type: "image", id: msg?.image?.id, caption: msg?.image?.caption, mimeType: msg?.image?.mime_type };
        } else if (msgType === "audio") {
          text = `[audio]`;
          mediaInfo = { type: "audio", id: msg?.audio?.id, mimeType: msg?.audio?.mime_type, duration: msg?.audio?.duration };
        } else if (msgType === "video") {
          text = `[video: ${msg?.video?.caption || ""}]`;
          mediaInfo = { type: "video", id: msg?.video?.id, caption: msg?.video?.caption };
        } else if (msgType === "document") {
          text = `[document: ${msg?.document?.filename || ""}]`;
          mediaInfo = { type: "document", id: msg?.document?.id, fileName: msg?.document?.filename };
        } else if (msgType === "button") {
          text = msg?.button?.text || "";
        } else if (msgType === "interactive") {
          text = msg?.interactive?.button_reply?.title || msg?.interactive?.list_reply?.title || "";
        }

        const contactName = contacts?.[0]?.profile?.name || "";
        const tenantId = asString(req.headers["x-tenant-id"] || req.query.tenantId);

        if (!tenantId) continue;

        const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!existingTenant) continue;

        const { conversation, message, isNewMessage } = await materializeIncomingMessage({
          tenantId,
          provider: "whatsapp_cloud",
          providerName: "WhatsApp Cloud API",
          externalConversationId: from,
          externalMessageId: msgId,
          contactExternalId: from,
          contactPayload: { name: contactName || from, phone: from, raw: msg },
          content: text,
          senderType: "contact",
          metadata: {
            event: "whatsapp_cloud.message",
            messageType: msgType,
            media: mediaInfo,
            phoneNumberId,
            displayPhoneNumber,
            raw: msg,
          },
        });

        if (isNewMessage && message?.senderType === "contact") {
          void addMessageJob({
            type: "incoming",
            tenantId,
            conversationId: conversation.id,
            messageId: message.id,
          }).catch((error) => logger.error("[Pipeline] whatsapp_cloud incoming failed", { error }));
        }
      }
    }
  }

  res.sendStatus(200);
});

async function sendCloudApiMessage(phoneNumberId: string, token: string, to: string, text: string) {
  const response = await fetch(`${CLOUD_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Cloud API error: ${response.status}`);
  }
  return data;
}

router.post("/whatsapp-cloud/send", whatsappSendLimiter, async (req: Request, res: Response) => {
  const config = getCloudApiConfig();

  if (!config.token || !config.phoneNumberId) {
    res.status(503).json({ error: "WhatsApp Cloud API não configurado" });
    return;
  }

  const { to, text } = req.body;
  if (!to || !text) {
    res.status(400).json({ error: "to e text são obrigatórios" });
    return;
  }

  try {
    const result = await sendCloudApiMessage(config.phoneNumberId, config.token, to, text);
    res.json({ sent: true, messageId: result?.messages?.[0]?.id, result });
  } catch (error: any) {
    res.status(502).json({ error: error.message || "Falha ao enviar via Cloud API" });
  }
});

router.post("/whatsapp-cloud/send/template", whatsappSendLimiter, async (req: Request, res: Response) => {
  const config = getCloudApiConfig();

  if (!config.token || !config.phoneNumberId) {
    res.status(503).json({ error: "WhatsApp Cloud API não configurado" });
    return;
  }

  const { to, templateName, languageCode, components } = req.body;
  if (!to || !templateName) {
    res.status(400).json({ error: "to e templateName são obrigatórios" });
    return;
  }

  try {
    const response = await fetch(`${CLOUD_API_BASE}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode || "pt_BR" },
          components: components || [],
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `Cloud API template error: ${response.status}`);
    }
    res.json({ sent: true, messageId: data?.messages?.[0]?.id, result: data });
  } catch (error: any) {
    res.status(502).json({ error: error.message || "Falha ao enviar template" });
  }
});

// ============================================================
// WAHA+ robust routes (stack-aware)
// ============================================================

router.get("/wahaplus/status", async (_req: Request, res: Response) => {
  try {
    const { baseUrl, response, data } = await fetchFirstWahaplus([
      "/api/health",
      "/api/sessions",
    ], undefined, 5000);
    res.json({
      connected: response.ok,
      configured: true,
      health: data,
      url: baseUrl,
      candidates: getWahaplusCandidateUrls(),
    });
  } catch (error: any) {
    res.json({
      connected: false,
      configured: getWahaplusCandidateUrls().length > 0,
      candidates: getWahaplusCandidateUrls(),
      error: error.message || "WAHA+ indisponivel",
    });
  }
});

router.get("/wahaplus/sessions", async (_req: Request, res: Response) => {
  try {
    const { data } = await fetchWahaplus("/api/sessions");
    res.json({ sessions: Array.isArray(data) ? data : data?.sessions || [] });
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponivel" });
  }
});

router.post("/wahaplus/sessions", async (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "name obrigatorio" });
    return;
  }

  try {
    const { baseUrl, response, data } = await fetchWahaplus("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    await fetchFirstWahaplus([
      `/api/sessions/${encodeURIComponent(name)}/start`,
      `/api/${encodeURIComponent(name)}/start`,
    ], { method: "POST" }, 5000).catch(() => null);
    res.status(response.status).json({ ...data, name: data?.name || name, url: baseUrl });
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponivel" });
  }
});

router.delete("/wahaplus/sessions/:sid", async (req: Request, res: Response) => {
  try {
    const sid = encodeURIComponent(req.params.sid);
    const { response } = await fetchFirstWahaplus([
      `/api/sessions/${sid}`,
      `/api/${sid}/logout`,
    ], { method: "DELETE" });
    res.status(response.status).end();
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponivel" });
  }
});

router.get("/wahaplus/sessions/:sid/qr", async (req: Request, res: Response) => {
  try {
    const sid = encodeURIComponent(req.params.sid);
    const { baseUrl, response, data } = await fetchFirstWahaplus([
      `/api/screenshot/${sid}`,
      `/api/${sid}/auth/qr`,
      `/api/sessions/${sid}/auth/qr`,
      `/api/sessions/${sid}/qr`,
      `/api/qr/${sid}`,
    ]);
    res.json({
      ...data,
      sessionId: req.params.sid,
      url: baseUrl,
      bridgeAvailable: response.ok,
      qr: data.qr || data.base64 || data.image || data.raw || null,
      error: response.ok ? data.error : (data.error || data.message || "QR nao disponivel nesta sessao"),
    });
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponivel" });
  }
});

// ============================================================
// WAHA+ (WhatsApp HTTP API Plus - waha-voip)
// ============================================================

router.get("/wahaplus/status", async (_req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.json({ connected: false, configured: false, error: "WAHAPLUS_URL nao configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/health`);
    const data = await response.json().catch(() => ({}));
    res.json({
      connected: response.ok,
      health: data,
      url: baseUrl,
    });
  } catch (error: any) {
    res.status(503).json({ connected: false, error: error.message || "WAHA+ indisponível" });
  }
});

router.get("/wahaplus/sessions", async (_req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions`);
    const data = await response.json().catch(() => []);
    res.json({ sessions: Array.isArray(data) ? data : data?.sessions || [] });
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.post("/wahaplus/sessions", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: "name é obrigatório" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.delete("/wahaplus/sessions/:sid", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}`, { method: "DELETE" });
    res.status(response.status).end();
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.get("/wahaplus/sessions/:sid/qr", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/screenshot/${req.params.sid}`);
    const data = await response.json().catch(() => ({}));
    res.json({
      ...data,
      sessionId: req.params.sid,
      bridgeAvailable: response.ok,
      qr: data.qr || data.base64 || null,
    });
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.post("/wahaplus/send", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  const { session, to, text } = req.body;
  if (!session || !to || !text) {
    res.status(400).json({ error: "session, to e text são obrigatórios" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sendText`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session, chatId: to, text }),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

// WAHA+ Call endpoints
router.get("/wahaplus/sessions/:sid/calls", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}/calls`);
    const data = await response.json().catch(() => []);
    res.json({ calls: Array.isArray(data) ? data : data?.calls || [] });
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.post("/wahaplus/sessions/:sid/calls", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  const { phone } = req.body;
  if (!phone) {
    res.status(400).json({ error: "phone é obrigatório" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}/calls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.post("/wahaplus/sessions/:sid/calls/:callId/webrtc", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  const { sdp_offer } = req.body;
  if (!sdp_offer) {
    res.status(400).json({ error: "sdp_offer é obrigatório" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}/calls/${req.params.callId}/webrtc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sdp_offer }),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.post("/wahaplus/sessions/:sid/calls/:callId/accept", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}/calls/${req.params.callId}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.post("/wahaplus/sessions/:sid/calls/:callId/reject", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}/calls/${req.params.callId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.delete("/wahaplus/sessions/:sid/calls/:callId", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}/calls/${req.params.callId}`, {
      method: "DELETE",
    });
    res.status(response.status).end();
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

router.get("/wahaplus/sessions/:sid/history", async (req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ error: "WAHAPLUS_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/api/sessions/${req.params.sid}/history`);
    const data = await response.json().catch(() => ({}));
    res.json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "WAHA+ indisponível" });
  }
});

export default router;
