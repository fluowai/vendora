import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission, clearPermissionCache } from "../middleware/permissions.ts";

const router = Router();
router.use(authMiddleware);

// ============= TEAM MANAGEMENT =============

router.get("/team", requirePermission("team", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        _count: { select: { conversations: true, tickets: true } },
        userRoles: { include: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const team = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      isSuperadmin: user.isSuperadmin,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      activeConversations: (user as any)._count?.conversations || 0,
      activeTickets: (user as any)._count?.tickets || 0,
      roles: user.userRoles.map((ur) => ur.role.name),
    }));

    res.json({ team });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar equipe" });
  }
});

router.post("/team/invite", requirePermission("team", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, email, password, roleName } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email e password são obrigatórios" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "Email já cadastrado" });
      return;
    }

    const { randomUUID } = await import("crypto");
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        name,
        email,
        passwordHash,
        tenantId,
      },
    });

    if (roleName) {
      const role = await prisma.role.findFirst({
        where: { tenantId, name: roleName },
      });
      if (role) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        });
      }
    }

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
        roles: roleName ? [roleName] : [],
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao convidar usuário" });
  }
});

router.put("/team/:id", requirePermission("team", "manage"), async (req: Request, res: Response) => {
  try {
    const { name, email, status, roleName } = req.body;
    const tenantId = req.user!.tenantId;

    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    const data: any = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (status) data.status = status;

    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data });
    }

    if (roleName) {
      const role = await prisma.role.findFirst({
        where: { tenantId, name: roleName },
      });
      if (role) {
        const existingRole = await prisma.userRole.findFirst({
          where: { userId: user.id },
        });
        if (existingRole) {
          await prisma.userRole.update({
            where: { id: existingRole.id },
            data: { roleId: role.id },
          });
        } else {
          await prisma.userRole.create({
            data: { userId: user.id, roleId: role.id },
          });
        }
      }
      clearPermissionCache(user.id);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

router.delete("/team/:id", requirePermission("team", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!user) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    if (req.user!.userId === user.id) {
      res.status(400).json({ error: "Você não pode remover a si mesmo" });
      return;
    }

    await prisma.user.delete({ where: { id: user.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao remover usuário" });
  }
});

// ============= ROLES MANAGEMENT =============

router.get("/roles", requirePermission("team", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const roles = await prisma.role.findMany({
      where: { tenantId },
      include: {
        permissions: true,
        _count: { select: { userRoles: true } },
      },
    });

    res.json({
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        permissions: role.permissions.map((p) => ({ action: p.action, subject: p.subject })),
        userCount: (role as any)._count?.userRoles || 0,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar papéis" });
  }
});

// ============= DEPARTMENTS =============

router.get("/departments", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const departments = await prisma.department.findMany({
      where: { tenantId },
      include: { _count: { select: { conversations: true, tickets: true } } },
      orderBy: { name: "asc" },
    });

    res.json({
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        conversationCount: (d as any)._count?.conversations || 0,
        ticketCount: (d as any)._count?.tickets || 0,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar departamentos" });
  }
});

router.post("/departments", requirePermission("settings", "write"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: "Nome do departamento é obrigatório" }); return; }

    const dept = await prisma.department.create({
      data: { tenantId, name },
    });
    res.status(201).json({ department: dept });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao criar departamento" });
  }
});

router.delete("/departments/:id", requirePermission("settings", "write"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const dept = await prisma.department.findFirst({ where: { id: req.params.id, tenantId } });
    if (!dept) { res.status(404).json({ error: "Departamento não encontrado" }); return; }
    await prisma.department.delete({ where: { id: dept.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao remover departamento" });
  }
});

// ============= SETTINGS =============

router.get("/settings", requirePermission("settings", "read"), async (req: Request, res: Response) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      include: { plan: true },
    });
    if (!tenant) { res.status(404).json({ error: "Tenant não encontrado" }); return; }

    res.json({
      settings: {
        company: tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        document: tenant.document,
        slug: tenant.slug,
        branding: tenant.branding,
        plan: tenant.plan
          ? {
              id: tenant.plan.id,
              name: tenant.plan.name,
              maxAgents: tenant.plan.maxAgents,
              maxConversations: tenant.plan.maxConversations,
              maxUsers: tenant.plan.maxUsers,
            }
          : null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar configurações" });
  }
});

router.put("/settings", requirePermission("settings", "write"), async (req: Request, res: Response) => {
  try {
    const { name, email, phone, document, branding } = req.body;
    const tenant = await prisma.tenant.update({
      where: { id: req.user!.tenantId },
      data: { name, email, phone, document, branding },
    });
    res.json({ success: true, tenant: { name: tenant.name, email: tenant.email, phone: tenant.phone } });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao atualizar configurações" });
  }
});

export default router;
