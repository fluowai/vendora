import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission, scopeFilter } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { emitToConversation, emitToTenant } from "../lib/socket.ts";
import { addMessageJob } from "../lib/queue.ts";
import { logger } from "../lib/logger.ts";

const router = Router();

router.use(authMiddleware);

function conversationWhere(req: Request, id: string) {
  if (req.user!.isSuperadmin) return { id };
  return { id, tenantId: req.user!.tenantId };
}

function mapConversation(conversation: any) {
  const lastMessage = conversation.messages?.[0] || null;
  const lastMetadata = (lastMessage?.metadata || {}) as any;
  return {
    id: conversation.id,
    contactId: conversation.contactId,
    name: conversation.contact?.name || "Contato",
    phone: conversation.contact?.phone,
    email: conversation.contact?.email,
    avatarUrl: conversation.contact?.avatarUrl,
    pushName: conversation.contact?.pushName,
    channel: conversation.channel,
    status: conversation.status,
    aiEnabled: conversation.aiEnabled,
    priority: conversation.priority,
    assignedUser: conversation.assignedUser
      ? { id: conversation.assignedUser.id, name: conversation.assignedUser.name }
      : null,
    instance: conversation.channelInstance
      ? {
          id: conversation.channelInstance.id,
          name: conversation.channelInstance.name,
          status: conversation.channelInstance.status,
          channelName: conversation.channelInstance.channel?.name,
          provider: conversation.channelInstance.channel?.provider,
        }
      : null,
    isGroup: !!lastMetadata.isGroup,
    chatType: lastMetadata.chatType || (lastMetadata.isGroup ? "group" : "private"),
    remoteJid: lastMetadata.remoteJid || lastMetadata.chatJid || null,
    lastMessage: lastMessage?.content || "",
    lastMessageAt: conversation.lastMessageAt || lastMessage?.sentAt || conversation.createdAt,
    time: conversation.lastMessageAt || lastMessage?.sentAt || conversation.createdAt,
    unread: 0,
    slaDueAt: conversation.slaDueAt,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
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

async function getOrCreateChannelInstance(tenantId: string, channelName: string) {
  const existing = await prisma.channelInstance.findFirst({
    where: {
      channel: { tenantId, provider: channelName },
      status: "active",
    },
  });

  if (existing) return existing;

  const channel = await prisma.channel.upsert({
    where: {
      id: `${tenantId}-${channelName}`,
    },
    update: { status: "active" },
    create: {
      id: `${tenantId}-${channelName}`,
      tenantId,
      name: channelName,
      provider: channelName,
      status: "active",
    },
  });

  return prisma.channelInstance.create({
    data: {
      channelId: channel.id,
      name: `${channelName} principal`,
      status: "active",
    },
  });
}

router.get("/",
  requirePermission("tickets", "read"),
  async (req: Request, res: Response) => {
    const { status, search, channel, chatType } = req.query as Record<string, string | undefined>;

    const where: any = req.user!.isSuperadmin ? {} : { tenantId: req.user!.tenantId };

    const scope = scopeFilter(req);
    Object.assign(where, scope);

    if (status && status !== "all") where.status = status;
    if (channel && channel !== "all") where.channel = channel;
    if (chatType === "group") {
      where.messages = { some: { metadata: { path: ["isGroup"], equals: true } } };
    } else if (chatType === "private") {
      where.OR = [
        { messages: { none: { metadata: { path: ["isGroup"], equals: true } } } },
        { messages: { some: { metadata: { path: ["isGroup"], equals: false } } } },
      ];
    }
    if (search) {
      const searchOr = [
        { contact: { name: { contains: search, mode: "insensitive" } } },
        { contact: { email: { contains: search, mode: "insensitive" } } },
        { contact: { phone: { contains: search, mode: "insensitive" } } },
        { messages: { some: { content: { contains: search, mode: "insensitive" } } } },
      ];
      where.AND = [...(where.AND || []), { OR: searchOr }];
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        contact: true,
        channelInstance: { include: { channel: true } },
        assignedUser: { select: { id: true, name: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });

    res.json({ conversations: conversations.map(mapConversation) });
  }
);

router.post("/",
  requirePermission("tickets", "write"),
  validate(schemas.createConversation),
  async (req: Request, res: Response) => {
    const { name, phone, email, channel = "web", initialMessage } = req.body;

    const tenantId = req.user!.tenantId;
    const channelInstance = await getOrCreateChannelInstance(tenantId, channel);
    const now = new Date();

    const conversation = await prisma.conversation.create({
      data: {
        tenant: { connect: { id: tenantId } },
        channel,
        status: "active",
        aiEnabled: true,
        lastMessageAt: initialMessage ? now : null,
        contact: {
          create: {
            tenant: { connect: { id: tenantId } },
            name,
            phone,
            email,
            source: channel,
          },
        },
        channelInstance: { connect: { id: channelInstance.id } },
        messages: initialMessage
          ? {
              create: {
                tenant: { connect: { id: tenantId } },
                senderType: "contact",
                senderId: phone || email || name,
                channel,
                messageType: "text",
                content: initialMessage,
                sentAt: now,
              },
            }
          : undefined,
      },
      include: {
        contact: true,
        channelInstance: { include: { channel: true } },
        assignedUser: { select: { id: true, name: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
    });

    emitToTenant(tenantId, "conversation:new", mapConversation(conversation));
    res.status(201).json({ conversation: mapConversation(conversation) });
  }
);

router.get("/:id",
  requirePermission("tickets", "read"),
  async (req: Request, res: Response) => {
    const conversation = await prisma.conversation.findFirst({
      where: conversationWhere(req, req.params.id),
      include: {
        contact: true,
        channelInstance: { include: { channel: true } },
        assignedUser: { select: { id: true, name: true } },
        messages: { orderBy: { sentAt: "asc" } },
      },
    });

    if (!conversation) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }

    res.json({
      conversation: {
        ...mapConversation({ ...conversation, messages: conversation.messages.slice(-1) }),
        messages: conversation.messages.map(mapMessage),
      },
    });
  }
);

router.patch("/:id",
  requirePermission("tickets", "write"),
  validate(schemas.updateConversation),
  async (req: Request, res: Response) => {
    const existing = await prisma.conversation.findFirst({
      where: conversationWhere(req, req.params.id),
    });
    if (!existing) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }

    const { status, aiEnabled, priority, assignedUserId, departmentId, contactName } = req.body;
    if (typeof contactName === "string" && contactName.trim()) {
      await prisma.contact.update({
        where: { id: existing.contactId },
        data: { name: contactName.trim() },
      });
    }
    const conversation = await prisma.conversation.update({
      where: { id: existing.id },
      data: { status, aiEnabled, priority, assignedUserId, departmentId },
      include: {
        contact: true,
        channelInstance: { include: { channel: true } },
        assignedUser: { select: { id: true, name: true } },
        messages: { orderBy: { sentAt: "desc" }, take: 1 },
      },
    });

    const mapped = mapConversation(conversation);
    emitToConversation(conversation.id, "conversation:updated", mapped);
    if (assignedUserId) {
      const { emitToUser } = await import("../lib/socket.ts");
      emitToUser(assignedUserId, "conversation:assigned", mapped);
    }

    res.json({ conversation: mapped });
  }
);

router.post("/:id/messages",
  requirePermission("tickets", "write"),
  validate(schemas.sendMessage),
  async (req: Request, res: Response) => {
    const { content, messageType = "text", metadata, mediaUrl, mediaMimeType, mediaName, mediaSize } = req.body;

    const conversation = await prisma.conversation.findFirst({
      where: conversationWhere(req, req.params.id),
    });
    if (!conversation) {
      res.status(404).json({ error: "Conversa não encontrada" });
      return;
    }

    const now = new Date();
    const message = await prisma.message.create({
      data: {
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        senderType: "user",
        senderId: req.user!.userId,
        channel: conversation.channel,
        messageType,
        content: content.trim(),
        mediaUrl: mediaUrl || null,
        mediaMimeType: mediaMimeType || null,
        mediaName: mediaName || null,
        mediaSize: mediaSize || null,
        metadata,
        sentAt: now,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    const mapped = mapMessage(message);
    emitToConversation(conversation.id, "message:new", {
      conversationId: conversation.id,
      message: mapped,
    });

    if (conversation.channel === "whatsmeow" || conversation.channel === "whatsapp_cloud" || conversation.channel === "wahaplus") {
      addMessageJob({
        type: "outgoing",
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        channel: conversation.channel,
        content: content.trim(),
        metadata: { messageType, mediaUrl, mediaMimeType, mediaName, mediaSize },
      }).catch((error) => logger.error("[Conversations] failed to queue outgoing", { error }));
    }

    res.status(201).json({ message: mapped });
  }
);

router.delete("/:id/messages/:messageId",
  requirePermission("tickets", "write"),
  async (req: Request, res: Response) => {
    const conversation = await prisma.conversation.findFirst({
      where: conversationWhere(req, req.params.id),
      include: { messages: { where: { id: req.params.messageId }, take: 1 } },
    });
    if (!conversation || conversation.messages.length === 0) {
      res.status(404).json({ error: "Mensagem nao encontrada" });
      return;
    }

    await prisma.message.delete({ where: { id: req.params.messageId } });

    const lastMessage = await prisma.message.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { sentAt: "desc" },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: lastMessage?.sentAt || null },
    });

    emitToConversation(conversation.id, "message:deleted", {
      conversationId: conversation.id,
      messageId: req.params.messageId,
      lastMessage: lastMessage ? mapMessage(lastMessage) : null,
    });

    res.json({ success: true, lastMessage: lastMessage ? mapMessage(lastMessage) : null });
  }
);

export default router;
