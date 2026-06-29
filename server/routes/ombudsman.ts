import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { z } from "zod";

const router = Router();
router.use(authMiddleware);

function generateProtocol(tenantSlug: string): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(Math.random() * 99999).toString().padStart(5, "0");
  return `${tenantSlug.toUpperCase()}-${year}-${seq}`;
}

const caseSchema = z.object({
  type: z.enum(["reclamacao", "denuncia", "sugestao", "elogio", "solicitacao"]),
  category: z.string().min(1, "Categoria obrigatória"),
  description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres"),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  contactId: z.string().uuid().optional().nullable(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  anonymous: z.boolean().default(false),
  departmentId: z.string().uuid().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
});

const updateCaseSchema = z.object({
  status: z.enum(["nova", "em_apuracao", "aguardando_resposta", "encaminhado", "encerrado"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  officialResponse: z.string().optional().nullable(),
  departmentId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
});

router.get("/cases", requirePermission("ombudsman", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, type, priority, search } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { protocolNumber: { contains: String(search) } },
        { description: { contains: String(search) } },
        { contact: { name: { contains: String(search) } } },
      ];
    }

    const cases = await prisma.ombudsmanCase.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      totalAbertos: await prisma.ombudsmanCase.count({
        where: { tenantId, status: { notIn: ["encerrado"] } },
      }),
      slaVencido: await prisma.ombudsmanCase.count({
        where: { tenantId, slaDueAt: { lte: new Date() }, status: { notIn: ["encerrado"] } },
      }),
      urgentes: await prisma.ombudsmanCase.count({
        where: { tenantId, priority: "urgent", status: { notIn: ["encerrado"] } },
      }),
      resolvidosMes: await prisma.ombudsmanCase.count({
        where: { tenantId, status: "encerrado", updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }),
    };

    res.json({ cases, stats });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar casos" });
  }
});

router.get("/cases/:id", requirePermission("ombudsman", "read"), async (req: Request, res: Response) => {
  try {
    const ombudsmanCase = await prisma.ombudsmanCase.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });
    if (!ombudsmanCase) { res.status(404).json({ error: "Caso não encontrado" }); return; }
    res.json({ case: ombudsmanCase });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar caso" });
  }
});

router.post("/cases", requirePermission("ombudsman", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = caseSchema.parse(req.body);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
    const protocolNumber = generateProtocol(tenant?.slug || "OUV");

    let contactId = data.contactId;
    if (!contactId && !data.anonymous && (data.contactName || data.contactEmail || data.contactPhone)) {
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: data.contactName || "Manifestante",
          email: data.contactEmail,
          phone: data.contactPhone,
          source: "ombudsman",
        },
      });
      contactId = contact.id;
    }

    const ombudsmanCase = await prisma.ombudsmanCase.create({
      data: {
        tenantId,
        protocolNumber,
        contactId: data.anonymous ? null : (contactId || null),
        type: data.type,
        category: data.category,
        description: data.description,
        status: "nova",
        priority: data.priority,
        severity: data.severity,
        anonymous: data.anonymous,
        departmentId: data.departmentId,
        assignedUserId: data.assignedUserId,
      },
      include: {
        contact: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ case: ombudsmanCase });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: error.flatten().fieldErrors });
      return;
    }
    res.status(500).json({ error: "Erro ao criar caso" });
  }
});

router.patch("/cases/:id", requirePermission("ombudsman", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = updateCaseSchema.parse(req.body);

    const existing = await prisma.ombudsmanCase.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ error: "Caso não encontrado" }); return; }

    const updateData: any = { ...data };
    if (data.status === "encerrado") {
      updateData.closedAt = new Date();
    }

    const ombudsmanCase = await prisma.ombudsmanCase.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        contact: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    res.json({ case: ombudsmanCase });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: error.flatten().fieldErrors });
      return;
    }
    res.status(500).json({ error: "Erro ao atualizar caso" });
  }
});

export default router;
