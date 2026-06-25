import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import {
  createAppointment,
  formatAppointment,
  getOrCreateDefaultCalendar,
  listAvailableSlots,
} from "../lib/calendar.ts";

const router = Router();
router.use(authMiddleware);

router.get("/calendars",
  requirePermission("settings", "read"),
  async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    await getOrCreateDefaultCalendar(tenantId);

    const calendars = await prisma.calendar.findMany({
      where: { tenantId },
      include: { availability: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({ calendars });
  }
);

router.put("/calendars/:id/availability",
  requirePermission("settings", "write"),
  validate(schemas.updateCalendarAvailability),
  async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const calendar = await prisma.calendar.findFirst({
      where: { id: req.params.id, tenantId },
    });
    if (!calendar) {
      res.status(404).json({ error: "Agenda nao encontrada" });
      return;
    }

    await prisma.calendarAvailability.deleteMany({ where: { calendarId: calendar.id } });
    await prisma.calendarAvailability.createMany({
      data: req.body.availability.map((item: any) => ({
        calendarId: calendar.id,
        weekday: item.weekday,
        startTime: item.startTime,
        endTime: item.endTime,
        isActive: item.isActive ?? true,
      })),
    });

    const updated = await prisma.calendar.findUnique({
      where: { id: calendar.id },
      include: { availability: true },
    });
    res.json({ calendar: updated });
  }
);

router.get("/slots",
  requirePermission("tickets", "read"),
  async (req: Request, res: Response) => {
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : undefined;
    const days = typeof req.query.days === "string" ? parseInt(req.query.days, 10) : undefined;
    const result = await listAvailableSlots(req.user!.tenantId, { from, limit, days });

    res.json({
      calendarId: result.calendar.id,
      slots: result.slots.map((slot) => slot.toISOString()),
    });
  }
);

router.get("/appointments",
  requirePermission("tickets", "read"),
  async (req: Request, res: Response) => {
    const tenantId = req.user!.tenantId;
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : undefined;

    const appointments = await prisma.appointment.findMany({
      where: {
        tenantId,
        ...(from || to
          ? {
              startsAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        aiAgent: { select: { id: true, name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 200,
    });

    res.json({ appointments: appointments.map(formatAppointment) });
  }
);

router.post("/appointments",
  requirePermission("tickets", "write"),
  validate(schemas.createAppointment),
  async (req: Request, res: Response) => {
    try {
      const appointment = await createAppointment({
        tenantId: req.user!.tenantId,
        contactId: req.body.contactId,
        conversationId: req.body.conversationId,
        aiAgentId: req.body.aiAgentId,
        title: req.body.title,
        description: req.body.description,
        startsAt: new Date(req.body.startsAt),
        durationMinutes: req.body.durationMinutes,
        source: "manual",
      });

      res.status(201).json({ appointment: formatAppointment(appointment) });
    } catch (error: any) {
      res.status(409).json({ error: error.message || "Nao foi possivel criar o agendamento" });
    }
  }
);

router.patch("/appointments/:id",
  requirePermission("tickets", "write"),
  validate(schemas.updateAppointment),
  async (req: Request, res: Response) => {
    const existing = await prisma.appointment.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!existing) {
      res.status(404).json({ error: "Agendamento nao encontrado" });
      return;
    }

    const appointment = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        title: req.body.title,
        description: req.body.description,
        status: req.body.status,
      },
    });
    res.json({ appointment: formatAppointment(appointment) });
  }
);

export default router;
