import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.ts";
import { logger } from "../lib/logger.ts";

const PERMISSION_CACHE_TTL = 30_000;
const permissionCache = new Map<string, { permissions: string[]; expiresAt: number }>();

async function getUserPermissions(userId: string): Promise<string[]> {
  const cached = permissionCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: true } } },
  });

  const permissions = userRoles.flatMap((ur) =>
    ur.role.permissions.map((p) => `${p.action}:${p.subject}`)
  );

  permissionCache.set(userId, { permissions, expiresAt: Date.now() + PERMISSION_CACHE_TTL });
  return permissions;
}

function clearPermissionCache(userId: string) {
  permissionCache.delete(userId);
}

function requirePermission(action: string, subject: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user?.isSuperadmin || req.user?.platformRole === "mega_admin" || req.user?.platformRole === "support") { next(); return; }
      if (!req.user) { res.status(401).json({ error: "Autenticação necessária" }); return; }

      const permissions = await getUserPermissions(req.user.userId);
      if (!permissions.includes(`${action}:${subject}`)) {
        res.status(403).json({ error: "Acesso negado: permissão necessária" });
        return;
      }
      next();
    } catch (error) {
      logger.error("Permission check error", { error });
      res.status(500).json({ error: "Erro ao verificar permissões" });
    }
  };
}

function scopeFilter(req: Request) {
  if (req.user?.isSuperadmin || req.user?.platformRole === "mega_admin") return {};
  const scope = req.query.scope as string | undefined;

  switch (scope) {
    case "assigned":
      return { assignedUserId: req.user!.userId };
    case "team":
      return { assignedUserId: { not: null } };
    default:
      return {};
  }
}

export { requirePermission, clearPermissionCache, scopeFilter };
