import prisma from "./prisma.ts";
import { Request } from "express";

interface AuditParams {
  tenantId: string
  userId?: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenant: { connect: { id: params.tenantId } },
        user: params.userId ? { connect: { id: params.userId } } : undefined,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as any,
      },
    });
  } catch (error) {
    console.error("Audit log error:", error);
  }
}

export function auditMiddleware(action: string, entityType: string) {
  return async (req: Request, _res: any, next: any) => {
    const originalJson = _res.json.bind(_res);
    _res.json = function (body: any) {
      if (_res.statusCode < 400 && req.user) {
        const entityId = req.params.id || body?.id || body?.conversation?.id || body?.agent?.id || "unknown";
        logAudit({
          tenantId: req.user.tenantId,
          userId: req.user.userId,
          action,
          entityType,
          entityId: String(entityId),
          metadata: {
            method: req.method,
            path: req.path,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          },
        }).catch(console.error);
      }
      return originalJson(body);
    };
    next();
  };
}
