import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { supabaseAdmin, isSupabaseReady } from "../lib/supabase.ts";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-this-to-a-random-secret-in-production") {
    console.warn("⚠️  JWT_SECRET não configurado. Defina um secret forte em produção.");
  }
  return secret || "insecure-dev-secret";
}

export interface AuthPayload {
  userId: string
  email: string
  tenantId: string
  isSuperadmin: boolean
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

export function generateRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, getJwtSecret() + "-refresh", { expiresIn: "30d" });
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
