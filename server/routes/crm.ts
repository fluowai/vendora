import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { z } from "zod";

const router = Router();
router.use(authMiddleware);

const dealSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  contactId: z.string().uuid().optional().nullable(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  funnelId: z.string().min(1, "Funil obrigatório"),
  stageId: z.string().min(1, "Etapa obrigatória"),
  value: z.number().positive().optional().nullable(),
  source: z.string().optional(),
  temperature: z.enum(["frio", "morno", "quente"]).optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
});

const updateDealSchema = z.object({
  title: z.string().min(1).optional(),
  stageId: z.string().min(1).optional(),
  value: z.number().positive().optional().nullable(),
  status: z.enum(["active", "won", "lost", "frozen"]).optional(),
  temperature: z.enum(["frio", "morno", "quente"]).optional(),
  score: z.number().int().min(0).max(100).optional().nullable(),
  assignedUserId: z.string().uuid().nullable().optional(),
  expectedCloseDate: z.string().datetime().nullable().optional(),
});

const funnelSchema = z.object({
  name: z.string().min(1, "Nome do funil obrigatório"),
  stages: z.array(z.object({
    name: z.string().min(1),
    order: z.number().int().min(0),
  })).min(1, "Pelo menos uma etapa é obrigatória"),
});

// ===== FUNNELS =====

router.get("/funnels", requirePermission("crm", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const funnels = await prisma.funnel.findMany({
      where: { tenantId },
      include: {
        stages: { orderBy: { order: "asc" } },
        _count: { select: { deals: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      funnels: funnels.map((f) => ({
        id: f.id,
        name: f.name,
        stages: f.stages,
        dealCount: (f as any)._count?.deals || 0,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar funis" });
  }
});

router.post("/funnels", requirePermission("crm", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { name, stages } = funnelSchema.parse(req.body);

    const funnel = await prisma.funnel.create({
      data: {
        tenantId,
        name,
        stages: {
          create: stages.map((s) => ({ name: s.name, order: s.order })),
        },
      },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    res.status(201).json({ funnel });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: error.flatten().fieldErrors });
      return;
    }
    res.status(500).json({ error: "Erro ao criar funil" });
  }
});

router.get("/stages/:funnelId", requirePermission("crm", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const funnel = await prisma.funnel.findFirst({
      where: { id: req.params.funnelId, tenantId },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            deals: {
              where: { status: "active" },
              include: {
                contact: { select: { id: true, name: true, email: true, phone: true } },
                assignedUser: { select: { id: true, name: true } },
              },
              orderBy: { updatedAt: "desc" },
            },
          },
        },
      },
    });

    if (!funnel) { res.status(404).json({ error: "Funil não encontrado" }); return; }

    const stages = funnel.stages.map((stage) => ({
      id: stage.id,
      funnelId: stage.funnelId,
      name: stage.name,
      order: stage.order,
      count: stage.deals.length,
      value: stage.deals.reduce((sum, d) => sum + (d.value || 0), 0),
      deals: stage.deals.map((deal) => ({
        id: deal.id,
        title: deal.title,
        value: deal.value,
        status: deal.status,
        temperature: deal.temperature,
        score: deal.score,
        contact: deal.contact,
        assignedUser: deal.assignedUser,
        expectedCloseDate: deal.expectedCloseDate,
        createdAt: deal.createdAt,
      })),
    }));

    res.json({
      funnel: { id: funnel.id, name: funnel.name },
      stages,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar etapas do funil" });
  }
});

// ===== DEALS =====

router.get("/deals", requirePermission("crm", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, funnelId } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (funnelId) where.funnelId = funnelId;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, companyName: true } },
        funnel: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, order: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ deals });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar deals" });
  }
});

router.post("/deals", requirePermission("crm", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = dealSchema.parse(req.body);

    let contactId = data.contactId;
    if (!contactId && (data.contactName || data.contactEmail || data.contactPhone)) {
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: data.contactName || "Lead sem nome",
          email: data.contactEmail,
          phone: data.contactPhone,
          source: "crm",
        },
      });
      contactId = contact.id;
    }

    const deal = await prisma.deal.create({
      data: {
        tenantId,
        contactId: contactId || "",
        funnelId: data.funnelId,
        stageId: data.stageId,
        title: data.title,
        value: data.value,
        status: "active",
        source: data.source,
        temperature: data.temperature,
        score: data.score,
        assignedUserId: data.assignedUserId,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
      },
      include: {
        contact: { select: { id: true, name: true } },
        funnel: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ deal });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: error.flatten().fieldErrors });
      return;
    }
    res.status(500).json({ error: "Erro ao criar deal" });
  }
});

router.patch("/deals/:id", requirePermission("crm", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = updateDealSchema.parse(req.body);

    const existing = await prisma.deal.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ error: "Deal não encontrado" }); return; }

    const updateData: any = { ...data };
    if (data.expectedCloseDate) updateData.expectedCloseDate = new Date(data.expectedCloseDate);

    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true } },
        funnel: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, order: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    res.json({ deal });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: error.flatten().fieldErrors });
      return;
    }
    res.status(500).json({ error: "Erro ao atualizar deal" });
  }
});

export default router;
