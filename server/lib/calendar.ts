import prisma from "./prisma.ts";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_SLOT_MINUTES = 60;
const SCHEDULE_INTENT = /\b(agendar|agenda|marcar|remarcar|consulta|reuni[aã]o|visita|hor[aá]rio|disponibilidade)\b/i;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function dateKey(date: Date) {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function minutesFromTime(time: string) {
  const [hours, minutes] = time.split(":").map((part) => parseInt(part, 10));
  return (hours || 0) * 60 + (minutes || 0);
}

function atMinutes(day: Date, minutes: number) {
  const date = new Date(day);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
}

function hasScheduleIntent(message: string) {
  return SCHEDULE_INTENT.test(message);
}

function parseRequestedDate(message: string, now = new Date()) {
  const text = message.toLowerCase();
  const timeMatch = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)?\b/);
  if (!timeMatch) return null;

  const hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const dateMatch = text.match(/\b([0-3]?\d)[/-]([01]?\d)(?:[/-](\d{2,4}))?\b/);

  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();

  if (dateMatch) {
    day = parseInt(dateMatch[1], 10);
    month = parseInt(dateMatch[2], 10) - 1;
    if (dateMatch[3]) {
      const parsedYear = parseInt(dateMatch[3], 10);
      year = parsedYear < 100 ? 2000 + parsedYear : parsedYear;
    }
  } else if (/\bamanh[aã]\b/.test(text)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    year = tomorrow.getFullYear();
    month = tomorrow.getMonth();
    day = tomorrow.getDate();
  } else if (!/\bhoje\b/.test(text)) {
    return null;
  }

  const requested = new Date(year, month, day, hours, minutes, 0, 0);
  if (!dateMatch && requested <= now) requested.setDate(requested.getDate() + 1);
  return requested;
}

export async function getOrCreateDefaultCalendar(tenantId: string) {
  const existing = await prisma.calendar.findFirst({
    where: { tenantId, status: "active" },
    include: { availability: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  return prisma.calendar.create({
    data: {
      tenantId,
      name: "Agenda principal",
      timezone: DEFAULT_TIMEZONE,
      slotMinutes: DEFAULT_SLOT_MINUTES,
      availability: {
        create: [1, 2, 3, 4, 5].map((weekday) => ({
          weekday,
          startTime: "09:00",
          endTime: "18:00",
        })),
      },
    },
    include: { availability: true },
  });
}

async function hasConflict(calendarId: string, startsAt: Date, endsAt: Date) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      calendarId,
      status: { in: ["scheduled", "confirmed"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  return !!conflict;
}

export async function isSlotAvailable(calendarId: string, startsAt: Date, durationMinutes: number) {
  const calendar = await prisma.calendar.findUnique({
    where: { id: calendarId },
    include: { availability: true },
  });
  if (!calendar) return false;

  const endsAt = addMinutes(startsAt, durationMinutes);
  const weekday = startsAt.getDay();
  const slotStart = startsAt.getHours() * 60 + startsAt.getMinutes();
  const slotEnd = endsAt.getHours() * 60 + endsAt.getMinutes();
  const window = calendar.availability.find((item) => {
    if (!item.isActive || item.weekday !== weekday) return false;
    return slotStart >= minutesFromTime(item.startTime) && slotEnd <= minutesFromTime(item.endTime);
  });
  if (!window) return false;

  return !(await hasConflict(calendarId, startsAt, endsAt));
}

export async function listAvailableSlots(tenantId: string, options: { from?: Date; days?: number; limit?: number } = {}) {
  const calendar = await getOrCreateDefaultCalendar(tenantId);
  const from = options.from || new Date();
  const days = options.days || 14;
  const limit = options.limit || 5;
  const slots: Date[] = [];

  for (let offset = 0; offset < days && slots.length < limit; offset += 1) {
    const day = new Date(from);
    day.setDate(from.getDate() + offset);
    day.setHours(0, 0, 0, 0);

    const windows = calendar.availability.filter((item) => item.isActive && item.weekday === day.getDay());
    for (const window of windows) {
      let cursor = atMinutes(day, minutesFromTime(window.startTime));
      const end = atMinutes(day, minutesFromTime(window.endTime));

      while (addMinutes(cursor, calendar.slotMinutes) <= end && slots.length < limit) {
        if (cursor > from && await isSlotAvailable(calendar.id, cursor, calendar.slotMinutes)) {
          slots.push(new Date(cursor));
        }
        cursor = addMinutes(cursor, calendar.slotMinutes);
      }
    }
  }

  return { calendar, slots };
}

export async function createAppointment(input: {
  tenantId: string
  calendarId?: string
  contactId?: string | null
  conversationId?: string | null
  aiAgentId?: string | null
  title: string
  description?: string
  startsAt: Date
  durationMinutes?: number
  source?: string
  metadata?: Record<string, unknown>
}) {
  const calendar = input.calendarId
    ? await prisma.calendar.findUnique({ where: { id: input.calendarId } })
    : await getOrCreateDefaultCalendar(input.tenantId);
  if (!calendar) throw new Error("Agenda nao encontrada");

  const durationMinutes = input.durationMinutes || calendar.slotMinutes || DEFAULT_SLOT_MINUTES;
  const endsAt = addMinutes(input.startsAt, durationMinutes);
  const available = await isSlotAvailable(calendar.id, input.startsAt, durationMinutes);
  if (!available) {
    throw new Error("Horario indisponivel");
  }

  return prisma.appointment.create({
    data: {
      tenantId: input.tenantId,
      calendarId: calendar.id,
      contactId: input.contactId || null,
      conversationId: input.conversationId || null,
      aiAgentId: input.aiAgentId || null,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt,
      source: input.source || "ai",
      metadata: (input.metadata || {}) as any,
    },
  });
}

export async function applySchedulingTool(input: {
  tenantId: string
  message: string
  contactId?: string | null
  conversationId?: string | null
  aiAgentId?: string | null
}) {
  if (!hasScheduleIntent(input.message)) return null;

  const calendar = await getOrCreateDefaultCalendar(input.tenantId);
  const requestedAt = parseRequestedDate(input.message);

  if (requestedAt) {
    const available = await isSlotAvailable(calendar.id, requestedAt, calendar.slotMinutes);
    if (available) {
      const appointment = await createAppointment({
        tenantId: input.tenantId,
        calendarId: calendar.id,
        contactId: input.contactId,
        conversationId: input.conversationId,
        aiAgentId: input.aiAgentId,
        title: "Atendimento agendado",
        description: `Criado automaticamente a partir da conversa ${input.conversationId || ""}`.trim(),
        startsAt: requestedAt,
        source: "ai-whatsapp",
        metadata: { originalMessage: input.message },
      });

      return {
        action: "appointment_created",
        appointment,
        context: `Ferramenta de agenda: horario reservado com sucesso para ${dateKey(appointment.startsAt)}. Confirme ao cliente de forma objetiva.`,
      };
    }

    const alternatives = await listAvailableSlots(input.tenantId, { from: requestedAt, limit: 3 });
    return {
      action: "slot_unavailable",
      appointment: null,
      context: `Ferramenta de agenda: o horario ${dateKey(requestedAt)} esta indisponivel. Ofereca estas alternativas: ${alternatives.slots.map(dateKey).join(", ") || "nenhum horario proximo encontrado"}.`,
    };
  }

  const available = await listAvailableSlots(input.tenantId, { limit: 5 });
  return {
    action: "availability_listed",
    appointment: null,
    context: `Ferramenta de agenda: o cliente quer agendar, mas nao informou data/hora completa. Ofereca estes horarios: ${available.slots.map(dateKey).join(", ") || "nenhum horario encontrado"}.`,
  };
}

export function formatAppointment(appointment: any) {
  return {
    id: appointment.id,
    calendarId: appointment.calendarId,
    contactId: appointment.contactId,
    conversationId: appointment.conversationId,
    aiAgentId: appointment.aiAgentId,
    title: appointment.title,
    description: appointment.description,
    status: appointment.status,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    source: appointment.source,
    metadata: appointment.metadata,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}
