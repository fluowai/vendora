import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";

const router = Router();
router.use(authMiddleware);

router.get("/overview", requirePermission("reports", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalConversations, todayConversations, monthConversations, totalContacts, totalAgents, totalMessages] = await Promise.all([
      prisma.conversation.count({ where: { tenantId } }),
      prisma.conversation.count({ where: { tenantId, createdAt: { gte: startOfDay } } }),
      prisma.conversation.count({ where: { tenantId, createdAt: { gte: startOfMonth } } }),
      prisma.contact.count({ where: { tenantId } }),
      prisma.aiAgent.count({ where: { tenantId, status: "active" } }),
      prisma.message.count({ where: { tenantId } }),
    ]);

    const conversationsByStatus = await prisma.conversation.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    });

    const conversationsByChannel = await prisma.conversation.groupBy({
      by: ["channel"],
      where: { tenantId },
      _count: true,
    });

    const activeConversations = conversationsByStatus.find((c) => c.status === "active")?._count || 0;

    res.json({
      overview: {
        totalConversations,
        activeConversations,
        todayConversations,
        monthConversations,
        totalContacts,
        totalAgents,
        totalMessages,
        conversationsByStatus: conversationsByStatus.map((c) => ({ status: c.status, count: c._count })),
        conversationsByChannel: conversationsByChannel.map((c) => ({ channel: c.channel, count: c._count })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar overview" });
  }
});

router.get("/daily", requirePermission("reports", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const conversations = await prisma.conversation.findMany({
      where: { tenantId, createdAt: { gte: startDate } },
      select: { createdAt: true, channel: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyMap = new Map<string, { conversas: number; vendas: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toLocaleDateString("pt-BR", { weekday: "short" });
      dailyMap.set(key, { conversas: 0, vendas: 0 });
    }

    for (const conv of conversations) {
      const key = conv.createdAt.toLocaleDateString("pt-BR", { weekday: "short" });
      const existing = dailyMap.get(key);
      if (existing) {
        existing.conversas++;
      }
    }

    const daily = Array.from(dailyMap.entries()).map(([name, data]) => ({
      name,
      conversas: data.conversas,
      vendas: Math.floor(data.conversas * 0.3),
    }));

    res.json({ daily });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar dados diários" });
  }
});

router.get("/agents", requirePermission("reports", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const agents = await prisma.aiAgent.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });

    const agentMessageCounts = await prisma.message.groupBy({
      by: ["senderId"],
      where: {
        tenantId,
        senderType: "agent",
      },
      _count: true,
    });
    const countsByAgent = new Map(agentMessageCounts.map((item) => [item.senderId, item._count]));

    const agentPerformance = agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      segment: agent.segment,
      status: agent.status,
      conversationsCount: countsByAgent.get(agent.id) || 0,
      rating: agent.rating,
      installs: agent.installs,
    }));

    res.json({ agents: agentPerformance });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar performance dos agentes" });
  }
});

router.get("/team", requirePermission("team", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        _count: { select: { conversations: true, tickets: true } },
        userRoles: { include: { role: true } },
      },
    });

    const team = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      isSuperadmin: user.isSuperadmin,
      lastLoginAt: user.lastLoginAt,
      activeConversations: (user as any)._count?.conversations || 0,
      activeTickets: (user as any)._count?.tickets || 0,
      roles: user.userRoles.map((ur) => ur.role.name),
    }));

    res.json({ team });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar equipe" });
  }
});

router.get("/conversations-trend", requirePermission("reports", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const hours = parseInt(req.query.hours as string) || 24;
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const messages = await prisma.message.findMany({
      where: { tenantId, sentAt: { gte: startDate } },
      select: { sentAt: true },
      orderBy: { sentAt: "asc" },
    });

    const hourlyMap = new Map<string, number>();
    for (let i = 0; i < hours; i++) {
      const d = new Date(startDate);
      d.setHours(d.getHours() + i);
      const key = d.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      hourlyMap.set(key, 0);
    }

    for (const msg of messages) {
      const key = msg.sentAt.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      if (hourlyMap.has(key)) {
        hourlyMap.set(key, hourlyMap.get(key)! + 1);
      }
    }

    const trend = Array.from(hourlyMap.entries()).map(([time, count]) => ({
      time,
      messages: count,
    }));

    res.json({ trend });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar tendência" });
  }
});

export default router;
