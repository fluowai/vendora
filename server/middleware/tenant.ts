import { Request, Response, NextFunction } from "express";

export function tenantIsolation(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }

  // Superadmin bypasses tenant isolation
  if (req.user.isSuperadmin) {
    next();
    return;
  }

  const requestTenantId = req.headers["x-tenant-id"] || req.params.tenantId || req.query.tenantId;
  if (requestTenantId && requestTenantId !== req.user.tenantId) {
    res.status(403).json({ error: "Acesso negado a este tenant" });
    return;
  }

  next();
}
