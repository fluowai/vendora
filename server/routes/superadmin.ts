import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.ts";
import { superadminAuth } from "../middleware/auth.ts";
import { logger } from "../lib/logger.ts";

const router = Router();

// All routes require superadmin auth
router.use(superadminAuth);

// ============= DASHBOARD STATS =============
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalTenants, totalUsers, totalAgents, totalConversations, plans] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.aiAgent.count(),
      prisma.conversation.count(),
      prisma.plan.findMany({ orderBy: { price: "asc" } }),
    ]);

    const tenantsByPlan = await prisma.tenant.groupBy({
      by: ["planId"],
      _count: true,
    });

    res.json({
      stats: {
        totalTenants,
        totalUsers,
        totalAgents,
        totalConversations,
        plans,
        tenantsByPlan: tenantsByPlan.map((t) => ({
          planId: t.planId,
          count: t._count,
        })),
      },
    });
  } catch (error: any) {
    logger.error("Superadmin stats error", { error });
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

// ============= PLAN MANAGEMENT =============
router.get("/plans", async (_req: Request, res: Response) => {
  const plans = await prisma.plan.findMany({ orderBy: { price: "asc" } });
  res.json({ plans });
});

router.post("/plans", async (req: Request, res: Response) => {
  try {
    const { id, name, price, maxAgents, maxConversations, maxChannels, maxUsers, features } = req.body;
    if (!id || !name) { res.status(400).json({ error: "id e name são obrigatórios" }); return; }

    const plan = await prisma.plan.create({
      data: { id, name, price: price || 0, maxAgents: maxAgents || 1, maxConversations: maxConversations || 500, maxChannels: maxChannels || 1, maxUsers: maxUsers || 1, features: features || [] },
    });
    res.status(201).json({ plan });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao criar plano" });
  }
});

router.put("/plans/:id", async (req: Request, res: Response) => {
  try {
    const { name, price, maxAgents, maxConversations, maxChannels, maxUsers, features, isActive } = req.body;
    const plan = await prisma.plan.update({
      where: { id: req.params.id },
      data: { name, price, maxAgents, maxConversations, maxChannels, maxUsers, features, isActive },
    });
    res.json({ plan });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar plano" });
  }
});

router.delete("/plans/:id", async (req: Request, res: Response) => {
  try {
    await prisma.plan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao deletar plano" });
  }
});

// ============= TENANT MANAGEMENT =============
router.get("/tenants", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", search, status, planId } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
        { slug: { contains: search as string, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;
    if (planId) where.planId = planId;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { users: true, aiAgents: true, conversations: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.tenant.count({ where }),
    ]);

    res.json({
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        email: t.email,
        document: t.document,
        phone: t.phone,
        status: t.status,
        planId: t.planId,
        branding: t.branding,
        createdAt: t.createdAt,
        userCount: t._count.users,
        agentCount: t._count.aiAgents,
        conversationCount: t._count.conversations,
      })),
      pagination: { page: parseInt(page as string), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error: any) {
    logger.error("Superadmin tenants error", { error });
    res.status(500).json({ error: "Erro ao buscar tenants" });
  }
});

router.get("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, aiAgents: true, conversations: true, channels: true, contacts: true } },
        users: { select: { id: true, name: true, email: true, status: true, isSuperadmin: true, lastLoginAt: true, createdAt: true } },
      },
    });
    if (!tenant) { res.status(404).json({ error: "Tenant não encontrado" }); return; }
    res.json({ tenant });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar tenant" });
  }
});

router.put("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const { name, slug, document, email, phone, status, planId, branding } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { name, slug, document, email, phone, status, planId, branding },
    });
    res.json({ tenant });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar tenant" });
  }
});

router.delete("/tenants/:id", async (req: Request, res: Response) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao deletar tenant" });
  }
});

// ============= USER MANAGEMENT (cross-tenant) =============
router.get("/users", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", tenantId, search } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        include: { tenant: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id, name: u.name, email: u.email, status: u.status,
        isSuperadmin: u.isSuperadmin, lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt, tenantName: u.tenant.name, tenantSlug: u.tenant.slug,
      })),
      pagination: { page: parseInt(page as string), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

router.put("/users/:id", async (req: Request, res: Response) => {
  try {
    const { name, email, status, isSuperadmin, password } = req.body;
    const data: any = { name, email, status, isSuperadmin };
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, status: true, isSuperadmin: true, tenantId: true },
    });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

// ============= WHITELABEL CONFIG =============
router.put("/tenants/:id/branding", async (req: Request, res: Response) => {
  try {
    const { logoUrl, primaryColor, secondaryColor, companyName, customDomain, faviconUrl } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: {
        branding: { logoUrl, primaryColor, secondaryColor, companyName, customDomain, faviconUrl },
      },
    });
    res.json({ branding: tenant.branding });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar branding" });
  }
});

export default router;
