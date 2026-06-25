import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission, scopeFilter } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { emitToConversation, emitToTenant } from "../lib/socket.ts";

const router = Router();

router.use(authMiddleware);

function conversationWhere(req: Request, id: string) {
  if (req.user!.isSuperadmin) return { id };
  return { id, tenantId: req.user!.tenantId };
}

function mapConversation(conversation: any) {
  const lastMessage = conversation.messages?.[0] || null;
  return {
    id: conversation.id,
    contactId: conversation.contactId,
    name: conversation.contact?.name || "Contato",
    phone: conversation.contact?.phone,
    email: conversation.contact?.email,
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
    const { status, search, channel } = req.query as Record<string, string | undefined>;

    const where: any = req.user!.isSuperadmin ? {} : { tenantId: req.user!.tenantId };

    const scope = scopeFilter(req);
    Object.assign(where, scope);

    if (status && status !== "all") where.status = status;
    if (channel && channel !== "all") where.channel = channel;
    if (search) {
      where.OR = [
        { contact: { name: { contains: search, mode: "insensitive" } } },
        { contact: { email: { contains: search, mode: "insensitive" } } },
        { contact: { phone: { contains: search, mode: "insensitive" } } },
        { messages: { some: { content: { contains: search, mode: "insensitive" } } } },
      ];
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

    const { status, aiEnabled, priority, assignedUserId, departmentId } = req.body;
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
    const { content, messageType = "text", metadata } = req.body;

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

    res.status(201).json({ message: mapped });
  }
);

export default router;
