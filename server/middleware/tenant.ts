import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.ts";

export async function tenantIsolation(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Autenticacao necessaria" });
    return;
  }

  if (req.user.isSuperadmin || req.user.platformRole === "mega_admin") {
    next();
    return;
  }

  const requestTenantId = req.headers["x-tenant-id"] || req.params.tenantId || req.query.tenantId;
  if (requestTenantId && requestTenantId !== req.user.tenantId) {
    if (req.user.roleScope === "whitelabel" && req.user.whiteLabelId) {
      const tenant = await prisma.tenant.findFirst({
        where: { id: String(requestTenantId), whiteLabelId: req.user.whiteLabelId },
        select: { id: true },
      });
      if (tenant) {
        next();
        return;
      }
    }

    res.status(403).json({ error: "Acesso negado a este tenant" });
    return;
  }

  next();
}
