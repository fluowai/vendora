import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.ts";
import { generateToken } from "../middleware/auth.ts";
import { superadminAuth } from "../middleware/auth.ts";
import { logger } from "../lib/logger.ts";

const router = Router();

// All routes require superadmin auth
router.use(superadminAuth);

// ============= DASHBOARD STATS =============
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalWhiteLabels, totalTenants, totalUsers, totalAgents, totalConversations, plans] = await Promise.all([
      prisma.whiteLabel.count(),
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
        totalWhiteLabels,
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

// ============= WHITELABEL MANAGEMENT =============
router.get("/whitelabels", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", search, status } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
        { slug: { contains: search as string, mode: "insensitive" } },
        { customDomain: { contains: search as string, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;

    const [whiteLabels, total] = await Promise.all([
      prisma.whiteLabel.findMany({
        where,
        skip,
        take,
        include: {
          plan: true,
          owner: { select: { id: true, name: true, email: true, status: true } },
          _count: { select: { tenants: true, users: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.whiteLabel.count({ where }),
    ]);

    res.json({
      whiteLabels: whiteLabels.map((wl) => ({
        id: wl.id,
        name: wl.name,
        slug: wl.slug,
        document: wl.document,
        email: wl.email,
        phone: wl.phone,
        status: wl.status,
        customDomain: wl.customDomain,
        branding: wl.branding,
        limits: wl.limits,
        planId: wl.planId,
        planName: wl.plan?.name,
        owner: wl.owner,
        tenantCount: wl._count.tenants,
        userCount: wl._count.users,
        createdAt: wl.createdAt,
      })),
      pagination: { page: parseInt(page as string), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error: any) {
    logger.error("Mega Admin whitelabel list error", { error });
    res.status(500).json({ error: "Erro ao buscar white labels" });
  }
});

router.post("/whitelabels", async (req: Request, res: Response) => {
  try {
    const { name, slug, document, email, phone, customDomain, branding, limits, planId, owner } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name e slug sao obrigatorios" }); return; }

    const whiteLabel = await prisma.whiteLabel.create({
      data: {
        name,
        slug,
        document,
        email,
        phone,
        customDomain,
        branding,
        limits,
        planId,
      },
    });

    let ownerUser = null;
    if (owner?.email && owner?.password) {
      const ownerTenant = await prisma.tenant.create({
        data: {
          whiteLabelId: whiteLabel.id,
          name: `${name} Operacao`,
          slug: `${slug}-operacao`,
          email: owner.email,
          planId: planId || "enterprise",
          branding,
        },
      });

      ownerUser = await prisma.user.create({
        data: {
          name: owner.name || "Super Admin",
          email: owner.email,
          passwordHash: await bcrypt.hash(owner.password, 12),
          tenantId: ownerTenant.id,
          whiteLabelId: whiteLabel.id,
          platformRole: "none",
          roleScope: "whitelabel",
        },
      });

      await prisma.whiteLabel.update({
        where: { id: whiteLabel.id },
        data: { ownerUserId: ownerUser.id },
      });
    }

    res.status(201).json({ whiteLabel: { ...whiteLabel, owner: ownerUser } });
  } catch (error: any) {
    logger.error("Mega Admin whitelabel create error", { error });
    res.status(500).json({ error: "Erro ao criar white label" });
  }
});

router.put("/whitelabels/:id", async (req: Request, res: Response) => {
  try {
    const { name, slug, document, email, phone, status, customDomain, branding, limits, billingConfig, planId, ownerUserId } = req.body;
    const whiteLabel = await prisma.whiteLabel.update({
      where: { id: req.params.id },
      data: { name, slug, document, email, phone, status, customDomain, branding, limits, billingConfig, planId, ownerUserId },
    });
    res.json({ whiteLabel });
  } catch (error: any) {
    logger.error("Mega Admin whitelabel update error", { error });
    res.status(500).json({ error: "Erro ao atualizar white label" });
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
    const { page = "1", limit = "20", search, status, planId, whiteLabelId } = req.query;
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
    if (whiteLabelId) where.whiteLabelId = whiteLabelId;

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take,
        include: {
          whiteLabel: { select: { id: true, name: true, slug: true } },
          _count: { select: { users: true, aiAgents: true, conversations: true } },
        },
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
        whiteLabelId: t.whiteLabelId,
        whiteLabelName: t.whiteLabel?.name,
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

router.post("/tenants", async (req: Request, res: Response) => {
  try {
    const { name, slug, document, email, phone, status, planId, whiteLabelId, branding, admin } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name e slug sao obrigatorios" }); return; }

    const tenant = await prisma.tenant.create({
      data: { name, slug, document, email, phone, status: status || "active", planId, whiteLabelId, branding },
    });

    if (admin?.email && admin?.password) {
      const user = await prisma.user.create({
        data: {
          name: admin.name || "Admin",
          email: admin.email,
          passwordHash: await bcrypt.hash(admin.password, 12),
          tenantId: tenant.id,
          whiteLabelId,
          platformRole: "none",
          roleScope: "tenant",
        },
      });
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: "admin",
          permissions: {
            create: [
              { action: "tickets", subject: "read" }, { action: "tickets", subject: "manage" },
              { action: "crm", subject: "read" }, { action: "crm", subject: "manage" },
              { action: "agents", subject: "read" }, { action: "agents", subject: "manage" },
              { action: "channels", subject: "read" }, { action: "channels", subject: "manage" },
              { action: "settings", subject: "read" }, { action: "settings", subject: "write" },
              { action: "team", subject: "read" }, { action: "team", subject: "manage" },
              { action: "calls", subject: "make" }, { action: "calls", subject: "manage" },
              { action: "campaigns", subject: "manage" },
              { action: "reports", subject: "read" },
            ],
          },
        },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }

    res.status(201).json({ tenant });
  } catch (error: any) {
    logger.error("Mega Admin tenant create error", { error });
    res.status(500).json({ error: "Erro ao criar tenant" });
  }
});

router.get("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { users: true, aiAgents: true, conversations: true, channels: true, contacts: true } },
        whiteLabel: { select: { id: true, name: true, slug: true, customDomain: true } },
        users: { select: { id: true, name: true, email: true, status: true, isSuperadmin: true, lastLoginAt: true, createdAt: true } },
      },
    });
    if (!tenant) { res.status(404).json({ error: "Tenant não encontrado" }); return; }
    res.json({ tenant });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar tenant" });
  }
});

router.post("/tenants/:id/support-session", async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        slug: true,
        planId: true,
        whiteLabelId: true,
      },
    });
    if (!tenant) { res.status(404).json({ error: "Tenant nao encontrado" }); return; }

    const token = generateToken({
      userId: req.user!.userId,
      email: req.user!.email,
      tenantId: tenant.id,
      whiteLabelId: tenant.whiteLabelId,
      isSuperadmin: false,
      platformRole: "support",
      roleScope: "tenant",
      supportMode: true,
      supportTenantId: tenant.id,
      supportTenantName: tenant.name,
    });

    res.json({
      token,
      user: {
        id: req.user!.userId,
        name: `Suporte Mega Admin`,
        email: req.user!.email,
        company: tenant.name,
        plan: tenant.planId,
        isSuperadmin: false,
        tenantId: tenant.id,
        whiteLabelId: tenant.whiteLabelId,
        platformRole: "support",
        roleScope: "tenant",
        supportMode: true,
        supportTenantId: tenant.id,
        supportTenantName: tenant.name,
      },
    });
  } catch (error: any) {
    logger.error("Mega Admin support session error", { error });
    res.status(500).json({ error: "Erro ao iniciar suporte" });
  }
});

router.put("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const { name, slug, document, email, phone, status, planId, whiteLabelId, branding } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { name, slug, document, email, phone, status, planId, whiteLabelId, branding },
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
