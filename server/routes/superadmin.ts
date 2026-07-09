import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.ts";
import { generateToken } from "../middleware/auth.ts";
import { superadminAuth } from "../middleware/auth.ts";
import { logger } from "../lib/logger.ts";

const router = Router();

// All routes require superadmin auth
router.use(superadminAuth);

const ADMIN_PERMISSIONS = [
  { action: "tickets", subject: "read" },
  { action: "tickets", subject: "manage" },
  { action: "crm", subject: "read" },
  { action: "crm", subject: "manage" },
  { action: "agents", subject: "read" },
  { action: "agents", subject: "manage" },
  { action: "channels", subject: "read" },
  { action: "channels", subject: "manage" },
  { action: "settings", subject: "read" },
  { action: "settings", subject: "write" },
  { action: "team", subject: "read" },
  { action: "team", subject: "manage" },
  { action: "calls", subject: "make" },
  { action: "calls", subject: "manage" },
  { action: "campaigns", subject: "manage" },
  { action: "reports", subject: "read" },
];

function compactData(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

async function deleteUserGraph(tx: any, userId: string) {
  await tx.whiteLabel.updateMany({ where: { ownerUserId: userId }, data: { ownerUserId: null } });
  await tx.conversation.updateMany({ where: { assignedUserId: userId }, data: { assignedUserId: null } });
  await tx.deal.updateMany({ where: { assignedUserId: userId }, data: { assignedUserId: null } });
  await tx.ticket.updateMany({ where: { assignedUserId: userId }, data: { assignedUserId: null } });
  await tx.ombudsmanCase.updateMany({ where: { assignedUserId: userId }, data: { assignedUserId: null } });
  await tx.appointment.updateMany({ where: { assignedUserId: userId }, data: { assignedUserId: null } });
  await tx.auditLog.updateMany({ where: { userId }, data: { userId: null } });
  await tx.pabxExtension.updateMany({ where: { userId }, data: { userId: null } });
  await tx.refreshToken.deleteMany({ where: { userId } });
  await tx.userRole.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
}

async function getTenantDeleteSummary(tenantId: string) {
  const [users, conversations, contacts, agents, tickets, campaigns] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.conversation.count({ where: { tenantId } }),
    prisma.contact.count({ where: { tenantId } }),
    prisma.aiAgent.count({ where: { tenantId } }),
    prisma.ticket.count({ where: { tenantId } }),
    prisma.dialingCampaign.count({ where: { tenantId } }),
  ]);
  return { users, conversations, contacts, agents, tickets, campaigns };
}

async function deleteTenantGraph(tx: any, tenantId: string) {
  const [
    users,
    roles,
    conversations,
    channels,
    calendars,
    knowledgeBases,
    flows,
    flowRuns,
    campaigns,
    queues,
    extensions,
    ivrMenus,
    funnels,
  ] = await Promise.all([
    tx.user.findMany({ where: { tenantId }, select: { id: true } }),
    tx.role.findMany({ where: { tenantId }, select: { id: true } }),
    tx.conversation.findMany({ where: { tenantId }, select: { id: true } }),
    tx.channel.findMany({ where: { tenantId }, select: { id: true } }),
    tx.calendar.findMany({ where: { tenantId }, select: { id: true } }),
    tx.knowledgeBase.findMany({ where: { tenantId }, select: { id: true } }),
    tx.agentFlow.findMany({ where: { tenantId }, select: { id: true } }),
    tx.flowRun.findMany({ where: { tenantId }, select: { id: true } }),
    tx.dialingCampaign.findMany({ where: { tenantId }, select: { id: true } }),
    tx.pabxQueue.findMany({ where: { tenantId }, select: { id: true } }),
    tx.pabxExtension.findMany({ where: { tenantId }, select: { id: true } }),
    tx.pabxIvrMenu.findMany({ where: { tenantId }, select: { id: true } }),
    tx.funnel.findMany({ where: { tenantId }, select: { id: true } }),
  ]);

  const userIds = users.map((item: { id: string }) => item.id);
  const roleIds = roles.map((item: { id: string }) => item.id);
  const conversationIds = conversations.map((item: { id: string }) => item.id);
  const channelIds = channels.map((item: { id: string }) => item.id);
  const calendarIds = calendars.map((item: { id: string }) => item.id);
  const knowledgeBaseIds = knowledgeBases.map((item: { id: string }) => item.id);
  const flowIds = flows.map((item: { id: string }) => item.id);
  const flowRunIds = flowRuns.map((item: { id: string }) => item.id);
  const campaignIds = campaigns.map((item: { id: string }) => item.id);
  const queueIds = queues.map((item: { id: string }) => item.id);
  const extensionIds = extensions.map((item: { id: string }) => item.id);
  const ivrMenuIds = ivrMenus.map((item: { id: string }) => item.id);
  const funnelIds = funnels.map((item: { id: string }) => item.id);

  await tx.whiteLabel.updateMany({ where: { ownerUserId: { in: userIds } }, data: { ownerUserId: null } });

  await tx.flowRunStep.deleteMany({ where: { runId: { in: flowRunIds } } });
  await tx.flowRun.deleteMany({ where: { tenantId } });
  await tx.flowVersion.deleteMany({ where: { flowId: { in: flowIds } } });
  await tx.agentFlow.deleteMany({ where: { tenantId } });

  await tx.callAttempt.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await tx.campaignContact.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await tx.dialingCampaign.deleteMany({ where: { tenantId } });

  await tx.appointment.deleteMany({ where: { tenantId } });
  await tx.message.deleteMany({ where: { tenantId } });
  await tx.deal.deleteMany({ where: { tenantId } });
  await tx.ticket.deleteMany({ where: { tenantId } });
  await tx.ombudsmanCase.deleteMany({ where: { tenantId } });
  await tx.conversation.deleteMany({ where: { tenantId } });

  await tx.contactIdentity.deleteMany({ where: { tenantId } });
  await tx.contact.deleteMany({ where: { tenantId } });

  await tx.document.deleteMany({ where: { knowledgeBaseId: { in: knowledgeBaseIds } } });
  await tx.knowledgeBase.deleteMany({ where: { tenantId } });

  await tx.calendarAvailability.deleteMany({ where: { calendarId: { in: calendarIds } } });
  await tx.calendar.deleteMany({ where: { tenantId } });

  await tx.pabxCallLog.deleteMany({ where: { tenantId } });
  await tx.pabxCallRoute.deleteMany({ where: { tenantId } });
  await tx.pabxIvrOption.deleteMany({ where: { ivrMenuId: { in: ivrMenuIds } } });
  await tx.pabxIvrMenu.deleteMany({ where: { tenantId } });
  await tx.pabxQueueMember.deleteMany({
    where: {
      OR: [
        { queueId: { in: queueIds } },
        { extensionId: { in: extensionIds } },
      ],
    },
  });
  await tx.pabxQueue.deleteMany({ where: { tenantId } });
  await tx.pabxExtension.deleteMany({ where: { tenantId } });

  await tx.channelInstance.deleteMany({ where: { channelId: { in: channelIds } } });
  await tx.channel.deleteMany({ where: { tenantId } });

  await tx.aiAgent.deleteMany({ where: { tenantId } });
  await tx.department.deleteMany({ where: { tenantId } });

  await tx.funnelStage.deleteMany({ where: { funnelId: { in: funnelIds } } });
  await tx.funnel.deleteMany({ where: { tenantId } });

  await tx.userRole.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        { roleId: { in: roleIds } },
      ],
    },
  });
  await tx.permission.deleteMany({ where: { roleId: { in: roleIds } } });
  await tx.role.deleteMany({ where: { tenantId } });

  await tx.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await tx.auditLog.deleteMany({ where: { tenantId } });
  await tx.user.deleteMany({ where: { tenantId } });
  await tx.tenant.delete({ where: { id: tenantId } });
}

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
    const [tenantCount, whiteLabelCount] = await Promise.all([
      prisma.tenant.count({ where: { planId: req.params.id } }),
      prisma.whiteLabel.count({ where: { planId: req.params.id } }),
    ]);

    if (tenantCount > 0 || whiteLabelCount > 0) {
      res.status(409).json({
        error: "Plano em uso. Altere os clientes/revendas antes de excluir.",
        usage: { clients: tenantCount, resellers: whiteLabelCount },
      });
      return;
    }

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

    if (admin?.email && admin?.password) {
      const existing = await prisma.user.findUnique({ where: { email: admin.email } });
      if (existing) { res.status(409).json({ error: "Email do admin ja cadastrado" }); return; }
    }

    const normalizedPlanId = planId || null;
    const normalizedWhiteLabelId = whiteLabelId || null;
    const tenant = await prisma.$transaction(async (tx) => {
      const createdTenant = await tx.tenant.create({
        data: {
          name,
          slug,
          document,
          email,
          phone,
          status: status || "active",
          planId: normalizedPlanId,
          whiteLabelId: normalizedWhiteLabelId,
          branding,
        },
      });

      if (admin?.email && admin?.password) {
        const user = await tx.user.create({
          data: {
            name: admin.name || "Admin",
            email: admin.email,
            passwordHash: await bcrypt.hash(admin.password, 12),
            tenantId: createdTenant.id,
            whiteLabelId: normalizedWhiteLabelId,
            platformRole: "none",
            roleScope: "tenant",
          },
        });
        const role = await tx.role.create({
          data: {
            tenantId: createdTenant.id,
            name: "admin",
            permissions: { create: ADMIN_PERMISSIONS },
          },
        });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }

      return createdTenant;
    });

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
      data: compactData({
        name,
        slug,
        document,
        email,
        phone,
        status,
        planId: planId === undefined ? undefined : planId || null,
        whiteLabelId: whiteLabelId === undefined ? undefined : whiteLabelId || null,
        branding,
      }),
    });
    res.json({ tenant });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar tenant" });
  }
});

router.delete("/tenants/:id", async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) { res.status(404).json({ error: "Cliente nao encontrado" }); return; }

    const megaAdminCount = await prisma.user.count({
      where: {
        tenantId: tenant.id,
        OR: [{ isSuperadmin: true }, { platformRole: "mega_admin" }],
      },
    });
    if (megaAdminCount > 0) {
      res.status(400).json({ error: "Nao e permitido excluir o cliente operacional do Mega Admin." });
      return;
    }

    const force = req.query.force === "true";
    const summary = await getTenantDeleteSummary(tenant.id);
    const hasData = Object.values(summary).some((count) => count > 0);
    if (!force && hasData) {
      res.status(409).json({
        error: "Cliente possui dados vinculados. Confirme a exclusao definitiva para remover tudo.",
        summary,
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await deleteTenantGraph(tx, tenant.id);
    }, { maxWait: 10000, timeout: 60000 });
    res.json({ success: true });
  } catch (error: any) {
    logger.error("Mega Admin tenant delete error", { error });
    res.status(500).json({ error: "Erro ao deletar tenant" });
  }
});

// ============= USER MANAGEMENT (cross-tenant) =============
router.get("/users", async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "20", tenantId, search, status, roleScope, whiteLabelId } = req.query;
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (status) where.status = status;
    if (roleScope) where.roleScope = roleScope;
    if (whiteLabelId) where.whiteLabelId = whiteLabelId;
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
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              whiteLabel: { select: { id: true, name: true, slug: true } },
            },
          },
          whiteLabel: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users: users.map((u) => ({
        id: u.id, name: u.name, email: u.email, status: u.status,
        isSuperadmin: u.isSuperadmin, lastLoginAt: u.lastLoginAt,
        platformRole: u.platformRole, roleScope: u.roleScope,
        tenantId: u.tenantId, whiteLabelId: u.whiteLabelId,
        createdAt: u.createdAt, tenantName: u.tenant.name, tenantSlug: u.tenant.slug,
        whiteLabelName: u.whiteLabel?.name || u.tenant.whiteLabel?.name || null,
        whiteLabelSlug: u.whiteLabel?.slug || u.tenant.whiteLabel?.slug || null,
      })),
      pagination: { page: parseInt(page as string), limit: take, total, totalPages: Math.ceil(total / take) },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

router.post("/users", async (req: Request, res: Response) => {
  try {
    const { name, email, password, tenantId, status, isSuperadmin, platformRole, roleScope, whiteLabelId, roleName } = req.body;
    if (!name || !email || !password || !tenantId) {
      res.status(400).json({ error: "name, email, password e tenantId sao obrigatorios" });
      return;
    }

    const [tenant, existing] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, whiteLabelId: true } }),
      prisma.user.findUnique({ where: { email } }),
    ]);
    if (!tenant) { res.status(404).json({ error: "Cliente nao encontrado" }); return; }
    if (existing) { res.status(409).json({ error: "Email ja cadastrado" }); return; }

    const normalizedIsSuperadmin = Boolean(isSuperadmin);
    const normalizedPlatformRole = normalizedIsSuperadmin ? "mega_admin" : (platformRole || "none");
    const normalizedRoleScope = normalizedIsSuperadmin ? "platform" : (roleScope || "tenant");
    const normalizedWhiteLabelId = whiteLabelId || tenant.whiteLabelId || null;
    if (normalizedRoleScope === "whitelabel" && !normalizedWhiteLabelId) {
      res.status(400).json({ error: "Selecione uma conta vinculada a uma revenda para criar usuario de revenda." });
      return;
    }

    const user = await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: await bcrypt.hash(password, 12),
          tenantId,
          whiteLabelId: normalizedWhiteLabelId,
          status: status || "active",
          isSuperadmin: normalizedIsSuperadmin,
          platformRole: normalizedPlatformRole,
          roleScope: normalizedRoleScope,
        },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          isSuperadmin: true,
          tenantId: true,
          whiteLabelId: true,
          platformRole: true,
          roleScope: true,
        },
      });

      if (roleName) {
        const role = await tx.role.findFirst({ where: { tenantId, name: roleName } });
        if (role) await tx.userRole.create({ data: { userId: createdUser.id, roleId: role.id } });
      }

      return createdUser;
    });

    res.status(201).json({ user });
  } catch (error: any) {
    logger.error("Mega Admin user create error", { error });
    res.status(500).json({ error: "Erro ao criar usuario" });
  }
});

router.put("/users/:id", async (req: Request, res: Response) => {
  try {
    const { name, email, status, isSuperadmin, platformRole, roleScope, tenantId, whiteLabelId, password } = req.body;
    const current = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!current) { res.status(404).json({ error: "Usuario nao encontrado" }); return; }

    const willBeMegaAdmin =
      isSuperadmin === undefined
        ? current.isSuperadmin || current.platformRole === "mega_admin"
        : Boolean(isSuperadmin) || platformRole === "mega_admin";

    if ((current.isSuperadmin || current.platformRole === "mega_admin") && !willBeMegaAdmin) {
      const megaAdminCount = await prisma.user.count({ where: { OR: [{ isSuperadmin: true }, { platformRole: "mega_admin" }] } });
      if (megaAdminCount <= 1) {
        res.status(400).json({ error: "Nao e permitido remover o ultimo Mega Admin." });
        return;
      }
    }

    const data: any = compactData({
      name,
      email,
      status,
      isSuperadmin,
      platformRole,
      roleScope,
      tenantId,
      whiteLabelId: whiteLabelId === undefined ? undefined : whiteLabelId || null,
    });
    if (!data.isSuperadmin && data.roleScope === "whitelabel" && !data.whiteLabelId && !current.whiteLabelId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: data.tenantId || current.tenantId },
        select: { whiteLabelId: true },
      });
      if (!tenant?.whiteLabelId) {
        res.status(400).json({ error: "Este usuario nao esta vinculado a uma revenda." });
        return;
      }
      data.whiteLabelId = tenant.whiteLabelId;
    }
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, name: true, email: true, status: true, isSuperadmin: true, tenantId: true, platformRole: true, roleScope: true },
    });
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, email: true, isSuperadmin: true, platformRole: true },
    });
    if (!user) { res.status(404).json({ error: "Usuario nao encontrado" }); return; }

    if (req.user!.userId === user.id) {
      res.status(400).json({ error: "Voce nao pode excluir o proprio usuario logado." });
      return;
    }

    if (user.isSuperadmin || user.platformRole === "mega_admin") {
      const megaAdminCount = await prisma.user.count({ where: { OR: [{ isSuperadmin: true }, { platformRole: "mega_admin" }] } });
      if (megaAdminCount <= 1) {
        res.status(400).json({ error: "Nao e permitido excluir o ultimo Mega Admin." });
        return;
      }
    }

    await prisma.$transaction(async (tx) => {
      await deleteUserGraph(tx, user.id);
    });
    res.json({ success: true });
  } catch (error: any) {
    logger.error("Mega Admin user delete error", { error });
    res.status(500).json({ error: "Erro ao excluir usuario" });
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
