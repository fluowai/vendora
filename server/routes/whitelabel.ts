import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.ts";
import { whitelabelAuth } from "../middleware/auth.ts";
import { logger } from "../lib/logger.ts";

const router = Router();

router.use(whitelabelAuth);

function getWhiteLabelId(req: Request): string | null {
  if (req.user?.platformRole === "mega_admin" || req.user?.isSuperadmin) {
    return (req.query.whiteLabelId as string) || (req.body.whiteLabelId as string) || null;
  }
  return req.user?.whiteLabelId || null;
}

const defaultTenantPermissions = [
  { action: "tickets", subject: "read" }, { action: "tickets", subject: "manage" },
  { action: "crm", subject: "read" }, { action: "crm", subject: "manage" },
  { action: "ombudsman", subject: "read" }, { action: "ombudsman", subject: "manage" },
  { action: "agents", subject: "read" }, { action: "agents", subject: "manage" },
  { action: "channels", subject: "read" }, { action: "channels", subject: "manage" },
  { action: "settings", subject: "read" }, { action: "settings", subject: "write" },
  { action: "team", subject: "read" }, { action: "team", subject: "manage" },
  { action: "calls", subject: "make" }, { action: "calls", subject: "manage" },
  { action: "campaigns", subject: "manage" },
  { action: "reports", subject: "read" },
];

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const whiteLabelId = getWhiteLabelId(req);
    if (!whiteLabelId) { res.status(400).json({ error: "whiteLabelId obrigatorio" }); return; }

    const [whiteLabel, totalTenants, totalUsers, totalAgents, totalConversations] = await Promise.all([
      prisma.whiteLabel.findUnique({ where: { id: whiteLabelId } }),
      prisma.tenant.count({ where: { whiteLabelId } }),
      prisma.user.count({ where: { whiteLabelId } }),
      prisma.aiAgent.count({ where: { tenant: { whiteLabelId } } }),
      prisma.conversation.count({ where: { tenant: { whiteLabelId } } }),
    ]);

    res.json({ stats: { whiteLabel, totalTenants, totalUsers, totalAgents, totalConversations } });
  } catch (error: any) {
    logger.error("WhiteLabel stats error", { error });
    res.status(500).json({ error: "Erro ao buscar estatisticas do white label" });
  }
});

router.get("/profile", async (req: Request, res: Response) => {
  try {
    const whiteLabelId = getWhiteLabelId(req);
    if (!whiteLabelId) { res.status(400).json({ error: "whiteLabelId obrigatorio" }); return; }
    const whiteLabel = await prisma.whiteLabel.findUnique({
      where: { id: whiteLabelId },
      include: { plan: true, owner: { select: { id: true, name: true, email: true } } },
    });
    if (!whiteLabel) { res.status(404).json({ error: "White label nao encontrado" }); return; }
    res.json({ whiteLabel });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar white label" });
  }
});

router.put("/profile", async (req: Request, res: Response) => {
  try {
    const whiteLabelId = getWhiteLabelId(req);
    if (!whiteLabelId) { res.status(400).json({ error: "whiteLabelId obrigatorio" }); return; }
    const { name, document, email, phone, customDomain, branding } = req.body;
    const whiteLabel = await prisma.whiteLabel.update({
      where: { id: whiteLabelId },
      data: { name, document, email, phone, customDomain, branding },
    });
    res.json({ whiteLabel });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar white label" });
  }
});

router.get("/tenants", async (req: Request, res: Response) => {
  try {
    const whiteLabelId = getWhiteLabelId(req);
    if (!whiteLabelId) { res.status(400).json({ error: "whiteLabelId obrigatorio" }); return; }
    const { search, status } = req.query;
    const where: any = { whiteLabelId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
        { slug: { contains: search as string, mode: "insensitive" } },
      ];
    }
    const tenants = await prisma.tenant.findMany({
      where,
      include: { plan: true, _count: { select: { users: true, aiAgents: true, conversations: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ tenants });
  } catch (error: any) {
    logger.error("WhiteLabel tenants error", { error });
    res.status(500).json({ error: "Erro ao buscar clientes" });
  }
});

router.post("/tenants", async (req: Request, res: Response) => {
  try {
    const whiteLabelId = getWhiteLabelId(req);
    if (!whiteLabelId) { res.status(400).json({ error: "whiteLabelId obrigatorio" }); return; }

    const { name, slug, document, email, phone, planId, branding, admin } = req.body;
    if (!name || !slug) { res.status(400).json({ error: "name e slug sao obrigatorios" }); return; }

    const tenant = await prisma.tenant.create({
      data: { whiteLabelId, name, slug, document, email, phone, planId, branding },
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
        data: { tenantId: tenant.id, name: "admin", permissions: { create: defaultTenantPermissions } },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    }

    res.status(201).json({ tenant });
  } catch (error: any) {
    logger.error("WhiteLabel tenant create error", { error });
    res.status(500).json({ error: "Erro ao criar cliente" });
  }
});

router.get("/users", async (req: Request, res: Response) => {
  try {
    const whiteLabelId = getWhiteLabelId(req);
    if (!whiteLabelId) { res.status(400).json({ error: "whiteLabelId obrigatorio" }); return; }
    const users = await prisma.user.findMany({
      where: { whiteLabelId },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar usuarios do white label" });
  }
});

export default router;
