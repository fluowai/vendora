import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma.ts";
import { generateToken, generateRefreshToken, rotateRefreshToken, revokeAllRefreshTokens, authMiddleware } from "../middleware/auth.ts";
import { supabaseAdmin, isSupabaseReady } from "../lib/supabase.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { logger } from "../lib/logger.ts";

const router = Router();

router.post("/register", validate(schemas.register), async (req: Request, res: Response) => {
  try {
    const { email, password, name, company } = req.body;
    if (password.length < 8) { res.status(400).json({ error: "Senha deve ter no mínimo 8 caracteres" }); return; }
    if (!/[A-Z]/.test(password)) { res.status(400).json({ error: "Senha deve conter pelo menos uma letra maiúscula" }); return; }
    if (!/[0-9]/.test(password)) { res.status(400).json({ error: "Senha deve conter pelo menos um número" }); return; }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) { res.status(409).json({ error: "Email já cadastrado" }); return; }

    const tenant = await prisma.tenant.create({
      data: {
        name: company || email.split("@")[0],
        slug: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-") + "-" + Date.now(),
        email,
        planId: "free",
      },
    });

    const passwordHash = await bcrypt.hash(password, 12);
    let userId: string;

    if (isSupabaseReady()) {
      const { data: sbData, error: sbError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          tenant_id: tenant.id,
          name: name || email.split("@")[0],
          is_superadmin: false,
        },
      });

      if (sbError) {
        await prisma.tenant.delete({ where: { id: tenant.id } });
        res.status(500).json({ error: "Erro ao criar usuário no Supabase" });
        return;
      }
      userId = sbData.user?.id!;
    } else {
      const { randomUUID } = await import("crypto");
      userId = randomUUID();
    }

    const user = await prisma.user.create({
      data: {
        id: userId,
        name: name || email.split("@")[0],
        email,
        passwordHash,
        tenantId: tenant.id,
      },
    });

    // Create default roles for the new tenant
    const defaultRoles = [
      { name: "admin", permissions: [
        { action: "tickets", subject: "read" }, { action: "tickets", subject: "manage" },
        { action: "crm", subject: "read" }, { action: "crm", subject: "manage" },
        { action: "ombudsman", subject: "read" }, { action: "ombudsman", subject: "manage" },
        { action: "agents", subject: "manage" }, { action: "agents", subject: "read" },
        { action: "channels", subject: "manage" }, { action: "channels", subject: "read" },
        { action: "settings", subject: "read" }, { action: "settings", subject: "write" },
        { action: "team", subject: "read" }, { action: "team", subject: "manage" },
        { action: "reports", subject: "read" },
      ]},
      { name: "supervisor", permissions: [
        { action: "tickets", subject: "read" }, { action: "tickets", subject: "manage" },
        { action: "crm", subject: "read" }, { action: "crm", subject: "manage" },
        { action: "ombudsman", subject: "read" }, { action: "ombudsman", subject: "manage" },
        { action: "agents", subject: "read" }, { action: "channels", subject: "read" },
        { action: "settings", subject: "read" }, { action: "team", subject: "read" },
        { action: "reports", subject: "read" },
      ]},
      { name: "agent", permissions: [
        { action: "tickets", subject: "read" }, { action: "tickets", subject: "manage" },
        { action: "crm", subject: "read" }, { action: "ombudsman", subject: "read" },
        { action: "agents", subject: "read" }, { action: "reports", subject: "read" },
      ]},
    ];

    const createdRoles: any[] = [];
    for (const r of defaultRoles) {
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: r.name,
          permissions: { create: r.permissions },
        },
      });
      createdRoles.push(role);
    }

    // Assign 'admin' role to the registering user (they own the tenant)
    const adminRole = createdRoles.find((r) => r.name === "admin")!;
    await prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    });

    const tokenPayload = { userId: user.id, email: user.email, tenantId: user.tenantId, isSuperadmin: false };
    const token = generateToken(tokenPayload);
    const refreshResult = await generateRefreshToken(tokenPayload);

    res.status(201).json({
      user: { id: user.id, name: user.name, email: user.email, company: tenant.name, plan: tenant.planId, isSuperadmin: false },
      token,
      refreshToken: refreshResult.token,
    });
  } catch (error: any) {
    logger.error("Register error", { error });
    res.status(500).json({ error: "Erro ao registrar" });
  }
});

router.post("/login", validate(schemas.login), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (isSupabaseReady()) {
      const { data: sbData, error: sbError } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (!sbError && sbData.user) {
        const user = await prisma.user.findUnique({
          where: { id: sbData.user.id },
          include: { tenant: true },
        });
        if (user) {
          await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
          const tokenPayload = { userId: user.id, email: user.email, tenantId: user.tenantId, isSuperadmin: user.isSuperadmin };
          const token = generateToken(tokenPayload);
          const refreshResult = await generateRefreshToken(tokenPayload);
          res.json({
            user: { id: user.id, name: user.name, email: user.email, company: user.tenant.name, plan: user.tenant.planId, isSuperadmin: user.isSuperadmin, tenantId: user.tenantId },
            token,
            refreshToken: refreshResult.token,
            sbSession: sbData.session,
          });
          return;
        }
      }
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) { res.status(401).json({ error: "Email ou senha inválidos" }); return; }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Email ou senha inválidos" }); return; }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const tokenPayload = { userId: user.id, email: user.email, tenantId: user.tenantId, isSuperadmin: user.isSuperadmin };
    const token = generateToken(tokenPayload);
    const refreshResult = await generateRefreshToken(tokenPayload);

    res.json({
      user: {
        id: user.id, name: user.name, email: user.email,
        company: user.tenant.name, plan: user.tenant.planId,
        isSuperadmin: user.isSuperadmin,
        tenantId: user.tenantId,
      },
      token,
      refreshToken: refreshResult.token,
    });
  } catch (error: any) {
    logger.error("Login error", { error });
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) { res.status(400).json({ error: "Refresh token obrigatório" }); return; }

    const result = await rotateRefreshToken(refreshToken);
    if (!result) { res.status(401).json({ error: "Refresh token inválido ou reutilizado. Faça login novamente." }); return; }

    res.json({ token: result.accessToken, refreshToken: result.refreshToken });
  } catch (error: any) {
    logger.error("Refresh error", { error });
    res.status(500).json({ error: "Erro ao renovar token" });
  }
});

router.post("/logout", authMiddleware, async (req: Request, res: Response) => {
  try {
    await revokeAllRefreshTokens(req.user!.userId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error("Logout error", { error });
    res.status(500).json({ error: "Erro ao fazer logout" });
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: { permissions: true },
            },
          },
        },
      },
    });
    if (!user) { res.status(404).json({ error: "Usuário não encontrado" }); return; }

    const permissions = user.userRoles.flatMap((ur) =>
      ur.role.permissions.map((p) => `${p.action}:${p.subject}`)
    );

    res.json({
      user: {
        id: user.id, name: user.name, email: user.email,
        company: user.tenant.name, plan: user.tenant.planId,
        isSuperadmin: user.isSuperadmin,
        tenantId: user.tenantId,
        permissions,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

export default router;
