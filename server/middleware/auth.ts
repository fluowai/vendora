import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { supabaseAdmin, isSupabaseReady } from "../lib/supabase.ts";
import { logger } from "../lib/logger.ts";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-this-to-a-random-secret-in-production") {
    console.warn("⚠️  JWT_SECRET não configurado. Defina um secret forte em produção.");
  }
  return secret || "insecure-dev-secret";
}

function getRefreshSecret(): string {
  return getJwtSecret() + "-refresh";
}

export interface AuthPayload {
  userId: string
  email: string
  tenantId: string
  isSuperadmin: boolean
  jti?: string
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export async function generateRefreshToken(payload: AuthPayload, family?: string): Promise<{ token: string; family: string }> {
  const tokenFamily = family || crypto.randomUUID();
  const jti = crypto.randomUUID();
  const token = jwt.sign({ ...payload, jti, family: tokenFamily }, getRefreshSecret(), { expiresIn: "30d" });

  const { default: prisma } = await import("../lib/prisma.ts");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId: payload.userId, tokenHash, family: tokenFamily, expiresAt },
  });

  return { token, family: tokenFamily };
}

export async function rotateRefreshToken(oldToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const { default: prisma } = await import("../lib/prisma.ts");

  let payload: AuthPayload;
  try {
    payload = jwt.verify(oldToken, getRefreshSecret()) as AuthPayload;
  } catch {
    return null;
  }

  const tokenHash = crypto.createHash("sha256").update(oldToken).digest("hex");
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!stored) {
    // Possível roubo de token — invalidar toda a família
    if ((payload as any).family) {
      await prisma.refreshToken.deleteMany({ where: { family: (payload as any).family } });
    }
    return null;
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    return null;
  }

  // Rotação: deleta o token usado e cria um novo
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const tokenPayload: AuthPayload = {
    userId: payload.userId,
    email: payload.email,
    tenantId: payload.tenantId,
    isSuperadmin: payload.isSuperadmin,
  };

  const accessToken = generateToken(tokenPayload);
  const newRefresh = await generateRefreshToken(tokenPayload, (payload as any).family);

  return { accessToken, refreshToken: newRefresh.token };
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  const { default: prisma } = await import("../lib/prisma.ts");
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, getJwtSecret()) as AuthPayload;
}

function isSupabaseToken(token: string): boolean {
  if (!isSupabaseReady()) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    return !!(payload.iss?.includes("supabase") || payload.aud === "authenticated");
  } catch { return false; }
}

async function resolveSupabaseUser(token: string): Promise<AuthPayload | null> {
  try {
    if (!isSupabaseReady() || !supabaseAdmin) return null;
    const { data: { user: sbUser }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !sbUser) return null;

    const metadata = sbUser.user_metadata;
    return {
      userId: sbUser.id,
      email: sbUser.email || "",
      tenantId: metadata?.tenant_id || sbUser.id,
      isSuperadmin: metadata?.is_superadmin === true,
    };
  } catch { return null; }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth) {
    res.status(401).json({ error: "Token não fornecido" });
    return;
  }

  const token = auth.replace("Bearer ", "");
  try {
    if (isSupabaseToken(token)) {
      const user = await resolveSupabaseUser(token);
      if (!user) { res.status(401).json({ error: "Token inválido ou expirado" }); return; }
      req.user = user;
    } else {
      const payload = verifyToken(token);
      req.user = payload;
    }
    next();
  } catch {
    res.status(401).json({ error: "Token inválido ou expirado" });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth) { next(); return; }

  const token = auth.replace("Bearer ", "");
  try {
    if (isSupabaseToken(token)) {
      req.user = await resolveSupabaseUser(token) || undefined;
    } else {
      req.user = verifyToken(token);
    }
  } catch {}
  next();
}

export function superadminAuth(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if (!req.user?.isSuperadmin) {
      res.status(403).json({ error: "Acesso restrito a administradores" });
      return;
    }
    next();
  });
}
