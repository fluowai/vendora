import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.ts";

const PLAN_LIMITS: Record<string, { maxAgents: number; maxConversations: number; maxChannels: number; maxUsers: number }> = {
  free: { maxAgents: 1, maxConversations: 500, maxChannels: 1, maxUsers: 1 },
  growth: { maxAgents: 5, maxConversations: 5000, maxChannels: 3, maxUsers: 10 },
  pro: { maxAgents: 999999, maxConversations: 50000, maxChannels: 999999, maxUsers: 50 },
  enterprise: { maxAgents: 999999, maxConversations: 99999999, maxChannels: 999999, maxUsers: 999999 },
};

type ResourceType = "agents" | "conversations" | "channels" | "users";

export function checkPlanLimit(resource: ResourceType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || req.user.isSuperadmin) {
        next();
        return;
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: req.user.tenantId },
      });

      if (!tenant) {
        res.status(404).json({ error: "Tenant não encontrado" });
        return;
      }

      const planId = tenant.planId || "free";
      const limits = PLAN_LIMITS[planId];
      if (!limits) {
        res.status(400).json({ error: "Plano inválido" });
        return;
      }

      let currentCount = 0;
      switch (resource) {
        case "agents":
          currentCount = await prisma.aiAgent.count({ where: { tenantId: tenant.id } });
          break;
        case "conversations": {
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          currentCount = await prisma.conversation.count({
            where: { tenantId: tenant.id, createdAt: { gte: startOfMonth } },
          });
          break;
        }
        case "channels":
          currentCount = await prisma.channel.count({ where: { tenantId: tenant.id } });
          break;
        case "users":
          currentCount = await prisma.user.count({ where: { tenantId: tenant.id } });
          break;
      }

      const limitKey = `max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof typeof limits;
      const maxLimit = limits[limitKey];

      if (currentCount >= maxLimit) {
        res.status(403).json({
          error: `Limite do plano excedido: máximo de ${maxLimit} ${resource}`,
          plan: planId,
          limit: maxLimit,
          current: currentCount,
        });
        return;
      }

      next();
    } catch (error: any) {
      console.error("Plan enforcer error:", error);
      res.status(500).json({ error: "Erro ao verificar limite do plano" });
    }
  };
}
