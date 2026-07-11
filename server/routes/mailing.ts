import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { normalizePhoneForCall } from "../lib/phone.ts";
import { wacalls, WacallsClientError, type WaContactValidationResult } from "../lib/wacalls-client.ts";
import { addJob } from "../lib/queue.ts";

const router = Router();

interface MailingContactInput {
  name?: string
  phone?: string
  email?: string
  metadata?: Record<string, unknown>
}

function handleError(res: Response, err: unknown) {
  if (err instanceof WacallsClientError) {
    res.status(err.status).json({ error: err.message });
  } else {
    const message = err instanceof Error ? err.message : "Erro interno";
    res.status(500).json({ error: message });
  }
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isMissingCampaignTableError(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021"
    || err instanceof Error && /DialingCampaign|CampaignContact|does not exist/i.test(err.message);
}

async function resolveSessionId(sessionId?: string) {
  if (sessionId) return sessionId;
  const data = await wacalls.listSessions();
  const connected = data.sessions.find((session) => session.paired && session.state === "open");
  return connected?.id || data.sessions.find((session) => session.paired)?.id || data.sessions[0]?.id || "";
}

router.use(authMiddleware);

router.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaigns = await prisma.dialingCampaign.findMany({
      where: { tenantId: req.user!.tenantId },
      include: {
        _count: { select: { contacts: true, attempts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ campaigns });
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/campaigns/:id", async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.dialingCampaign.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      include: {
        contacts: { orderBy: { createdAt: "asc" }, take: 200 },
        attempts: { orderBy: { createdAt: "desc" }, take: 200 },
      },
    });
    if (!campaign) {
      res.status(404).json({ error: "Campanha nao encontrada" });
      return;
    }
    res.json({ campaign });
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/campaigns/:id/start", async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.dialingCampaign.findFirst({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
    });
    if (!campaign) {
      res.status(404).json({ error: "Campanha nao encontrada" });
      return;
    }
    if (!campaign.sessionId && !process.env.DIALER_DEFAULT_SESSION_ID) {
      res.status(400).json({ error: "Configure uma conexao de voz para iniciar a campanha" });
      return;
    }

    const updated = await prisma.dialingCampaign.update({
      where: { id: campaign.id },
      data: {
        status: "active",
        scheduleStart: req.body?.scheduleStart ? new Date(req.body.scheduleStart) : campaign.scheduleStart,
        scheduleEnd: req.body?.scheduleEnd ? new Date(req.body.scheduleEnd) : campaign.scheduleEnd,
      },
    });

    await addJob("dialer", "process", { campaignId: updated.id }, { delay: 500 });
    res.json({ campaign: updated });
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/campaigns/:id/pause", async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.dialingCampaign.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: { status: "paused" },
    });
    if (!campaign.count) {
      res.status(404).json({ error: "Campanha nao encontrada" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/campaigns/:id/cancel", async (req: Request, res: Response) => {
  try {
    const campaign = await prisma.dialingCampaign.updateMany({
      where: { id: req.params.id, tenantId: req.user!.tenantId },
      data: { status: "cancelled" },
    });
    if (!campaign.count) {
      res.status(404).json({ error: "Campanha nao encontrada" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts as MailingContactInput[] : [];
    const saveValid = Boolean(req.body?.saveValid);
    const campaignName = cleanText(req.body?.campaignName) || `Mailing validado ${new Date().toLocaleDateString("pt-BR")}`;
    const sessionId = await resolveSessionId(cleanText(req.body?.sessionId));

    if (!sessionId) {
      res.status(400).json({ error: "Nenhuma sessao WaCalls encontrada" });
      return;
    }
    if (contacts.length === 0) {
      res.status(400).json({ error: "Nenhum contato enviado" });
      return;
    }
    if (contacts.length > 2000) {
      res.status(400).json({ error: "Envie no maximo 2000 contatos por validacao" });
      return;
    }

    const byPhone = new Map<string, MailingContactInput>();
    const invalidRows: WaContactValidationResult[] = [];
    for (const contact of contacts) {
      const phone = normalizePhoneForCall(contact.phone);
      if (!phone) {
        invalidRows.push({
          input: contact.phone || "",
          phone: "",
          isOnWhatsApp: false,
          error: "telefone invalido",
        });
        continue;
      }
      if (!byPhone.has(phone)) {
        byPhone.set(phone, {
          ...contact,
          name: cleanText(contact.name),
          email: cleanText(contact.email),
          phone,
        });
      }
    }

    const phones = [...byPhone.keys()];
    const validation = phones.length
      ? await wacalls.validateContacts(sessionId, phones, true, req.user!.userId)
      : { results: [] };

    const results = [
      ...invalidRows,
      ...validation.results.map((row) => {
        const source = byPhone.get(row.phone) || byPhone.get(normalizePhoneForCall(row.input));
        return {
          ...row,
          name: source?.name || row.pushName || row.businessName || "",
          email: source?.email || "",
          metadata: source?.metadata || {},
        };
      }),
    ];

    let campaign: { id: string; name: string } | null = null;
    let saveWarning: string | null = null;
    const validRows = results.filter((row) => row.isOnWhatsApp && row.phone);
    if (saveValid && validRows.length > 0) {
      try {
        const created = await prisma.dialingCampaign.create({
          data: {
            tenantId: req.user!.tenantId,
            name: campaignName,
            description: "Mailing validado pelo WhatsApp",
            status: "draft",
            mode: "preview",
            sessionId,
            totalContacts: validRows.length,
            contacts: {
              create: validRows.map((row: any) => ({
                name: row.name || row.pushName || row.businessName || null,
                phone: row.phone,
                email: row.email || null,
                metadata: {
                  jid: row.jid || null,
                  lid: row.lid || null,
                  pushName: row.pushName || null,
                  businessName: row.businessName || null,
                  avatarUrl: row.avatarUrl || null,
                  photoStatus: row.photoStatus || null,
                  source: row.metadata || {},
                },
              })),
            },
          },
          select: { id: true, name: true },
        });
        campaign = created;
      } catch (err) {
        if (!isMissingCampaignTableError(err)) throw err;
        saveWarning = "Mailing validado, mas a tabela de campanhas ainda nao existe no banco. Rode a sincronizacao do Prisma para salvar campanhas.";
      }
    }

    res.json({
      sessionId,
      campaign,
      saveWarning,
      summary: {
        total: results.length,
        uniquePhones: phones.length,
        valid: validRows.length,
        invalid: results.filter((row) => !row.isOnWhatsApp).length,
        errors: results.filter((row) => row.error).length,
      },
      results,
    });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
