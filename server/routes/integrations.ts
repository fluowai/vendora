import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { webhookLimiter, whatsappSendLimiter, whatsappMediaLimiter } from "../middleware/rate-limit.ts";
import { addMessageJob } from "../lib/queue.ts";
import { logger } from "../lib/logger.ts";
import { uploadBuffer } from "../lib/storage.ts";

const router = Router();

function getWebhookSecret() {
  return process.env.CHATWOOT_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "";
}

function getWhatsmeowBridgeUrl() {
  return (process.env.WHATSMEOW_BRIDGE_URL || "").replace(/\/$/, "");
}

function getWhatsmeowHeaders() {
  return {
    "Content-Type": "application/json",
    ...(process.env.WHATSMEOW_BRIDGE_SECRET ? { Authorization: `Bearer ${process.env.WHATSMEOW_BRIDGE_SECRET}` } : {}),
  } as Record<string, string>;
}

function getWahaplusUrl() {
  return (process.env.WAHAPLUS_URL || "").replace(/\/$/, "");
}

function whatsmeowBridgeError(error?: any) {
  const message = error?.message || String(error || "");
  if (!message || message === "fetch failed" || message.includes("ECONNREFUSED")) {
    return "Bridge WhatsApp offline. Inicie o whatsmeow-bridge na porta 4000 para gerar o QR Code.";
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

function assertWebhookSecret(req: Request, res: Response): boolean {
  const expected = getWebhookSecret();
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

function asString(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function isWhatsAppGroupJid(value: string) {
  return value.endsWith("@g.us");
}

function isLid(value: string) {
  return /@lid$/i.test(value);
}

function jidToPhone(value: string) {
  const cleaned = asString(value).replace(/@.+$/, "").replace(/\D/g, "");
  return cleaned.length >= 10 ? cleaned : "";
}

function normalizeWhatsAppJid(value: string) {
  const trimmed = asString(value).trim();
  if (!trimmed || isLid(trimmed)) return "";
  if (trimmed.includes("@")) return trimmed;
  const phone = jidToPhone(trimmed);
  return phone ? `${phone}@s.whatsapp.net` : "";
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
  });
}

async function getOrCreateContact(tenantId: string, provider: string, channel: string, externalId: string, payload: any) {
  const existingIdentity = externalId
    ? await prisma.contactIdentity.findFirst({ where: { tenantId, provider, externalId }, include: { contact: true } })
    : null;

  if (existingIdentity?.contact) {
    const betterName = payload?.name && payload.name !== existingIdentity.contact.name ? payload.name : undefined;
    const betterPhone = payload?.phone && payload.phone !== existingIdentity.contact.phone ? payload.phone : undefined;
    const avatarUrl = payload?.avatarUrl && payload.avatarUrl !== existingIdentity.contact.avatarUrl ? payload.avatarUrl : undefined;
    const pushName = payload?.pushName && payload.pushName !== existingIdentity.contact.pushName ? payload.pushName : undefined;
    if (betterName || betterPhone || avatarUrl || pushName) {
      return prisma.contact.update({
        where: { id: existingIdentity.contact.id },
        data: {
          ...(betterName ? { name: betterName } : {}),
          ...(betterPhone ? { phone: betterPhone } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
          ...(pushName ? { pushName } : {}),
        },
      });
    }
    return existingIdentity.contact;
  }

  const name = payload?.name || payload?.sender?.name || payload?.contact?.name || "Contato Chatwoot";
  const email = payload?.email || payload?.sender?.email || payload?.contact?.email;
  const phone = payload?.phone_number || payload?.phone || payload?.sender?.phone_number || payload?.contact?.phone_number;

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

  if (externalId) {
    await prisma.contactIdentity.create({
      data: {
        tenantId,
        contactId: contact.id,
        channel,
        provider,
        externalId,
        username: name,
        phone,
        email,
        metadata: payload || {},
      },
    });
  }

  return contact;
}

async function materializeIncomingMessage(input: {
  tenantId: string
  provider: string
  providerName: string
  instanceId?: string
  externalConversationId: string
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
          channel: { tenantId: input.tenantId, provider: input.provider },
        },
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
  const conversationId = stableId(input.provider, input.tenantId, channelInstance.id, input.externalConversationId);
  const now = new Date();

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

  return { conversation, message, isNewMessage };
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

  const { conversation, message, isNewMessage } = await materializeIncomingMessage({
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

router.post("/whatsmeow/incoming", webhookLimiter, async (req: Request, res: Response) => {
  if (!assertWebhookSecret(req, res)) return;

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

  const rawFrom = asString(req.body.from || req.body.senderJid || req.body.senderAltJid || req.body.sender || req.body.remoteJid || req.body.jid);
  const from = normalizeWhatsAppJid(rawFrom) || rawFrom;
  const chatJid = asString(req.body.chatId || req.body.remoteJid || req.body.conversationId || from);
  const participantJid = asString(req.body.participantJid || req.body.senderJid || (isWhatsAppGroupJid(chatJid) ? from : ""));
  const messageId = asString(req.body.messageId || req.body.id);
  const text = asString(req.body.text || req.body.content || req.body.message?.text || req.body.message?.conversation);
  const conversationKey = chatJid;
  const hasMedia = !!req.body.hasMedia;
  const media = req.body.media || null;
  const messageType = asString(req.body.messageType || (hasMedia ? "media" : "text"));
  const isGroup = req.body.isGroup === true || req.body.chatType === "group" || isWhatsAppGroupJid(chatJid);
  const chatType = isGroup ? "group" : "private";
  const senderPhone = jidToPhone(from || participantJid);
  const senderDisplayName = displayWhatsAppIdentity({
    pushName: req.body.pushName,
    senderName: req.body.senderName,
    jid: from || participantJid,
  });
  const groupName = asString(req.body.groupName || req.body.chatName || req.body.name || "Grupo WhatsApp");
  const storedMedia = hasMedia ? await persistIncomingMedia(tenantId, messageId, media).catch((error) => {
    logger.error("[Whatsmeow] failed to persist incoming media", { error });
    return null;
  }) : null;

  if (!from || !conversationKey) {
    res.status(400).json({ error: "from/remoteJid obrigatório no payload whatsmeow" });
    return;
  }

  const { conversation, message, isNewMessage } = await materializeIncomingMessage({
    tenantId,
    provider: "whatsmeow",
    providerName: "WhatsApp whatsmeow",
    instanceId,
    externalConversationId: conversationKey,
    externalMessageId: messageId,
    contactExternalId: isGroup ? chatJid : from,
    contactPayload: {
      name: isGroup ? groupName : senderDisplayName,
      phone: isGroup ? null : senderPhone,
      pushName: isGroup ? null : senderDisplayName,
      avatarUrl: asString(req.body.avatarUrl || ""),
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
      senderJid: from,
      participantJid,
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
      const response = await fetch(`${bridgeUrl}/status`);
      const data = await response.json().catch(() => ({}));
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
        await fetch(`${bridgeUrl}/config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.WHATSMEOW_BRIDGE_SECRET ? { Authorization: `Bearer ${process.env.WHATSMEOW_BRIDGE_SECRET}` } : {}),
          },
          body: JSON.stringify({ webhookUrl: instanceConfig.webhookUrl }),
        });
      }
      const response = await fetch(`${bridgeUrl}/qr`);
      const data = await response.json().catch(() => ({}));
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
      const response = await fetch(`${bridgeUrl}/logout`, {
        method: "POST",
        headers: getWhatsmeowHeaders(),
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        await prisma.channelInstance.update({
          where: { id: instance.id },
          data: { status: "disconnected" },
        });
      }

      res.status(response.status).json({ ...data, instanceId: instance.id });
    } catch (error: any) {
      res.status(503).json({ error: whatsmeowBridgeError(error) });
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
    const response = await fetch(`${bridgeUrl}/status`);
    const data = await response.json().catch(() => ({}));
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
    const response = await fetch(`${bridgeUrl}/qr`);
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.post("/whatsmeow/pair/code", whatsappSendLimiter, async (req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL nÃ£o configurado" });
    return;
  }

  const { phone, showPushNotification, clientType, clientDisplayName } = req.body;
  if (!phone) {
    res.status(400).json({ error: "phone obrigatorio" });
    return;
  }

  try {
    const response = await fetch(`${bridgeUrl}/pair/code`, {
      method: "POST",
      headers: getWhatsmeowHeaders(),
      body: JSON.stringify({ phone, showPushNotification: !!showPushNotification, clientType, clientDisplayName }),
    });
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: error.message || "Bridge whatsmeow indisponivel" });
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

  const response = await fetch(`${bridgeUrl}/send`, {
    method: "POST",
    headers: getWhatsmeowHeaders(),
    body: JSON.stringify({ to, text, conversationId }),
  });
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
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

  const response = await fetch(`${bridgeUrl}/send/media`, {
    method: "POST",
    headers: getWhatsmeowHeaders(),
    body: JSON.stringify({ to, caption, mediaUrl, mediaType, fileName, conversationId }),
  });
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
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

  const response = await fetch(`${bridgeUrl}/typing`, {
    method: "POST",
    headers: getWhatsmeowHeaders(),
    body: JSON.stringify({ to, state: state || "typing" }),
  });
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
});

router.get("/whatsmeow/health", async (_req: Request, res: Response) => {
  const bridgeUrl = getWhatsmeowBridgeUrl();
  if (!bridgeUrl) {
    res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
    return;
  }

  try {
    const response = await fetch(`${bridgeUrl}/health`);
    const data = await response.json().catch(() => ({}));
    res.status(response.status).json(data);
  } catch (error: any) {
    res.status(503).json({ error: whatsmeowBridgeError(error) });
  }
});

router.post("/whatsmeow/incoming/receipt", webhookLimiter, async (req: Request, res: Response) => {
  if (!assertWebhookSecret(req, res)) return;

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

  const messageIds: string[] = req.body.messageIds || [];
  const receiptType = asString(req.body.receiptType);

  if (messageIds.length > 0) {
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
// WAHA+ (WhatsApp HTTP API Plus - waha-voip)
// ============================================================

router.get("/wahaplus/status", async (_req: Request, res: Response) => {
  const baseUrl = getWahaplusUrl();
  if (!baseUrl) {
    res.status(503).json({ connected: false, error: "WAHAPLUS_URL não configurado" });
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
