import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { z } from "zod";

const router = Router();
router.use(authMiddleware);

const ticketSchema = z.object({
  title: z.string().min(1, "Título obrigatório"),
  description: z.string().min(1, "Descrição obrigatória"),
  contactId: z.string().uuid().optional().nullable(),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  departmentId: z.string().uuid().optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
});

const updateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  status: z.enum(["aberto", "pendente", "resolvido", "fechado"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
});

router.get("/", requirePermission("tickets", "read"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const { status, priority, search } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (search) {
      where.OR = [
        { title: { contains: String(search) } },
        { contact: { name: { contains: String(search) } } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const stats = {
      abertos: await prisma.ticket.count({ where: { tenantId, status: "aberto" } }),
      slaVencido: await prisma.ticket.count({
        where: { tenantId, slaDueAt: { lte: new Date() }, status: { notIn: ["resolvido", "fechado"] } },
      }),
      altaPrioridade: await prisma.ticket.count({ where: { tenantId, priority: { in: ["high", "urgent"] }, status: { notIn: ["resolvido", "fechado"] } } }),
      resolvidosMes: await prisma.ticket.count({
        where: { tenantId, status: "resolvido", updatedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }),
    };

    res.json({ tickets, stats });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar tickets" });
  }
});

router.get("/:id", requirePermission("tickets", "read"), async (req: Request, res: Response) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: {
        contact: { select: { id: true, name: true, email: true, phone: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
        conversation: { select: { id: true, channel: true } },
      },
    });
    if (!ticket) { res.status(404).json({ error: "Ticket não encontrado" }); return; }
    res.json({ ticket });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao buscar ticket" });
  }
});

router.post("/", requirePermission("tickets", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = ticketSchema.parse(req.body);

    let contactId = data.contactId;
    if (!contactId && (data.contactName || data.contactEmail || data.contactPhone)) {
      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: data.contactName || "Contato sem nome",
          email: data.contactEmail,
          phone: data.contactPhone,
          source: "ticket",
        },
      });
      contactId = contact.id;
    }

    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        contactId: contactId || "",
        title: data.title,
        description: data.description,
        status: "aberto",
        priority: data.priority,
        departmentId: data.departmentId,
        assignedUserId: data.assignedUserId,
      },
      include: {
        contact: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    res.status(201).json({ ticket });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: error.flatten().fieldErrors });
      return;
    }
    res.status(500).json({ error: "Erro ao criar ticket" });
  }
});

router.patch("/:id", requirePermission("tickets", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = updateTicketSchema.parse(req.body);

    const existing = await prisma.ticket.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ error: "Ticket não encontrado" }); return; }

    const ticket = await prisma.ticket.update({
      where: { id: req.params.id },
      data,
      include: {
        contact: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true } },
      },
    });

    res.json({ ticket });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Dados inválidos", details: error.flatten().fieldErrors });
      return;
    }
    res.status(500).json({ error: "Erro ao atualizar ticket" });
  }
});

router.delete("/:id", requirePermission("tickets", "manage"), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const existing = await prisma.ticket.findFirst({ where: { id: req.params.id, tenantId } });
    if (!existing) { res.status(404).json({ error: "Ticket não encontrado" }); return; }
    await prisma.ticket.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: "Erro ao remover ticket" });
  }
});

export default router;
