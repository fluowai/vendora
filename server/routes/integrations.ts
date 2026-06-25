import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { addMessageJob } from "../lib/queue.ts";

const router = Router();

function getWebhookSecret() {
  return process.env.CHATWOOT_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || "";
}

function getWhatsmeowBridgeUrl() {
  return (process.env.WHATSMEOW_BRIDGE_URL || "").replace(/\/$/, "");
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

  if (existingIdentity?.contact) return existingIdentity.contact;

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
          messageType: "text",
          content: input.content,
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

router.post("/chatwoot/webhook", async (req: Request, res: Response) => {
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
    }).catch((error) => console.error("[Pipeline] chatwoot incoming failed", error));
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
        sendPath: "/api/integrations/whatsmeow/send",
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
      connections: channels.flatMap((channel) => channel.instances.map((instance) => ({
        id: instance.id,
        name: instance.name,
        status: instance.status,
        config: instance.config,
        webhookUrl: (instance.config as any)?.webhookUrl,
        qrPath: (instance.config as any)?.qrPath,
        statusPath: (instance.config as any)?.statusPath,
        channel: {
          id: channel.id,
          name: channel.name,
          provider: channel.provider,
          status: channel.status,
          config: channel.config,
        },
      }))),
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

router.post("/whatsmeow/incoming", async (req: Request, res: Response) => {
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

  const from = asString(req.body.from || req.body.sender || req.body.remoteJid || req.body.jid);
  const messageId = asString(req.body.messageId || req.body.id);
  const text = asString(req.body.text || req.body.content || req.body.message?.text || req.body.message?.conversation);
  const conversationKey = asString(req.body.chatId || req.body.conversationId || req.body.remoteJid || from);

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
    contactExternalId: from,
    contactPayload: {
      name: req.body.pushName || req.body.name || from,
      phone: from.replace(/@.+$/, ""),
      raw: req.body,
    },
    content: text,
    senderType: "contact",
    metadata: {
      event: "whatsmeow.message",
      remoteJid: from,
      instanceId,
      raw: req.body,
    },
  });

  if (isNewMessage && message?.senderType === "contact") {
    void addMessageJob({
      type: "incoming",
      tenantId,
      conversationId: conversation.id,
      messageId: message.id,
    }).catch((error) => console.error("[Pipeline] whatsmeow incoming failed", error));
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
      res.status(503).json({ connected: false, error: "WHATSMEOW_BRIDGE_URL não configurado" });
      return;
    }

    try {
      const response = await fetch(`${bridgeUrl}/status`);
      const data = await response.json().catch(() => ({}));
      res.status(response.status).json({ ...data, instanceId: instance.id });
    } catch (error: any) {
      res.status(503).json({ connected: false, error: error.message || "Bridge whatsmeow indisponível" });
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
      res.status(503).json({ error: "WHATSMEOW_BRIDGE_URL não configurado" });
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
      res.status(response.status).json({ ...data, instanceId: instance.id });
    } catch (error: any) {
      res.status(503).json({ error: error.message || "Bridge whatsmeow indisponível" });
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
    res.status(503).json({ connected: false, error: error.message || "Bridge whatsmeow indisponível" });
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
    res.status(503).json({ error: error.message || "Bridge whatsmeow indisponível" });
  }
});

router.post("/whatsmeow/send", async (req: Request, res: Response) => {
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
    headers: {
      "Content-Type": "application/json",
      ...(process.env.WHATSMEOW_BRIDGE_SECRET ? { Authorization: `Bearer ${process.env.WHATSMEOW_BRIDGE_SECRET}` } : {}),
    },
    body: JSON.stringify({ to, text, conversationId }),
  });
  const data = await response.json().catch(() => ({}));
  res.status(response.status).json(data);
});

export default router;
