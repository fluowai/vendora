import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { normalizePhoneForCall } from "../lib/phone.ts";
import { wacalls, WacallsClientError, type WaContactValidationResult } from "../lib/wacalls-client.ts";
import { addJob } from "../lib/queue.ts";
import { executeLLM } from "../lib/providers.ts";

const router = Router();

interface MailingContactInput {
  name?: string
  phone?: string
  email?: string
  metadata?: Record<string, unknown>
}

interface SmartCampaignInput {
  campaignName?: string
  objective?: string
  funnelId?: string
  sessionIds?: string[]
  contacts?: MailingContactInput[]
  mediaUrls?: string[]
  links?: string[]
  tone?: string
  variantCount?: number
  rotationStrategy?: string
  intervalSeconds?: number
  dailyLimit?: number
  model?: string
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

function cleanTextList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 12)
    : [];
}

function asPositiveInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function safeJson(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = (fenced || value).trim();
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(source.slice(start, end + 1));
  } catch {
    return null;
  }
}

function fallbackVariants(objective: string, count: number, links: string[]) {
  const mainLink = links[0] ? ` ${links[0]}` : "";
  const baseObjective = objective || "apresentar a oferta e iniciar uma conversa";
  return [
    `Oi {{nome}}, tudo bem? Separei uma novidade para voce: ${baseObjective}.${mainLink} Posso te mandar os detalhes?`,
    `{{nome}}, passando rapido porque isso pode fazer sentido para voce: ${baseObjective}.${mainLink} Quer que eu te explique em 1 minuto?`,
    `Ola {{nome}}. Estamos falando com alguns contatos sobre ${baseObjective}.${mainLink} Se fizer sentido, responda por aqui que eu continuo.`,
    `Oi, {{nome}}. Tenho uma mensagem objetiva sobre ${baseObjective}.${mainLink} Posso te mostrar como funciona?`,
    `{{nome}}, tudo certo? A ideia e simples: ${baseObjective}.${mainLink} Me responde com "sim" que eu envio o proximo passo.`,
  ].slice(0, count).map((body, index) => ({ title: `Variacao ${index + 1}`, body }));
}

async function composeGroqVariants(input: {
  objective: string
  tone: string
  variantCount: number
  links: string[]
  mediaUrls: string[]
  model?: string
}) {
  const prompt = `
Crie ${input.variantCount} mensagens diferentes para uma campanha de WhatsApp.
Objetivo: ${input.objective}
Tom: ${input.tone}
Links disponiveis: ${input.links.join(", ") || "nenhum"}
Midias disponiveis: ${input.mediaUrls.join(", ") || "nenhuma"}

Regras:
- Responda somente JSON valido.
- Use portugues do Brasil.
- Nao prometa garantia, retorno financeiro ou resultado absoluto.
- Evite linguagem agressiva de spam.
- Cada mensagem deve ter no maximo 420 caracteres.
- Use {{nome}} como personalizacao opcional.
- Nao repita a mesma abertura em todas as mensagens.

Formato:
{"variants":[{"title":"...","body":"..."}],"safetyNotes":["..."]}
`;

  const result = await executeLLM({
    provider: "groq",
    model: input.model || "llama-3.3-70b-versatile",
    temperature: 0.86,
    maxTokens: 1400,
    systemPrompt: "Voce e um estrategista de campanhas WhatsApp com foco em entregabilidade, variacao semantica e clareza comercial.",
  }, prompt);

  const parsed = safeJson(result.text);
  const variants = Array.isArray(parsed?.variants)
    ? parsed.variants
        .map((item: any, index: number) => ({
          title: cleanText(item?.title) || `Variacao ${index + 1}`,
          body: cleanText(item?.body),
        }))
        .filter((item: any) => item.body)
        .slice(0, input.variantCount)
    : [];

  return {
    variants,
    safetyNotes: Array.isArray(parsed?.safetyNotes) ? parsed.safetyNotes.map(cleanText).filter(Boolean).slice(0, 5) : [],
    usage: result.usage || null,
  };
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
    if (isMissingCampaignTableError(err)) {
      res.json({
        campaigns: [],
        migrationRequired: true,
        warning: "As tabelas de campanhas de ligacao ainda nao existem no banco. Rode as migrations antes de salvar ou executar campanhas.",
      });
      return;
    }
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
    if (isMissingCampaignTableError(err)) {
      res.status(404).json({
        error: "Tabelas de campanhas de ligacao ainda nao existem no banco",
        migrationRequired: true,
      });
      return;
    }
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
    if (campaign.mode === "whatsapp_ai") {
      const updated = await prisma.dialingCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "active",
          scheduleStart: req.body?.scheduleStart ? new Date(req.body.scheduleStart) : campaign.scheduleStart,
          scheduleEnd: req.body?.scheduleEnd ? new Date(req.body.scheduleEnd) : campaign.scheduleEnd,
        },
      });
      res.json({ campaign: updated, dispatchMode: "whatsapp_ai" });
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

router.post("/smart-campaign", async (req: Request, res: Response) => {
  try {
    const body = req.body as SmartCampaignInput;
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];
    const sessionIds = cleanTextList(body.sessionIds);
    const campaignName = cleanText(body.campaignName) || `Disparo inteligente ${new Date().toLocaleDateString("pt-BR")}`;
    const objective = cleanText(body.objective);
    const funnelId = cleanText(body.funnelId);
    const mediaUrls = cleanTextList(body.mediaUrls);
    const links = cleanTextList(body.links);
    const tone = cleanText(body.tone) || "consultivo e humano";
    const variantCount = asPositiveInt(body.variantCount, 5, 3, 12);
    const intervalSeconds = asPositiveInt(body.intervalSeconds, 90, 15, 3600);
    const dailyLimit = asPositiveInt(body.dailyLimit, 250, 1, 5000);
    const rotationStrategy = cleanText(body.rotationStrategy) || "round_robin";
    const model = cleanText(body.model) || "llama-3.3-70b-versatile";

    if (!objective) {
      res.status(400).json({ error: "Informe o objetivo da campanha" });
      return;
    }
    if (contacts.length === 0) {
      res.status(400).json({ error: "Suba uma lista com contatos antes de criar a campanha" });
      return;
    }
    if (contacts.length > 2000) {
      res.status(400).json({ error: "Envie no maximo 2000 contatos por campanha" });
      return;
    }
    if (sessionIds.length === 0) {
      res.status(400).json({ error: "Selecione pelo menos uma instancia WhatsApp para rotacao" });
      return;
    }

    const availableInstances = await prisma.channelInstance.findMany({
      where: {
        id: { in: sessionIds },
        channel: {
          tenantId: req.user!.tenantId,
          provider: { in: ["whatsmeow", "whatsapp_cloud", "wahaplus"] },
        },
      },
      include: { channel: true },
    });
    if (availableInstances.length === 0) {
      res.status(400).json({ error: "Nenhuma instancia WhatsApp valida foi encontrada" });
      return;
    }

    const validSessionIds = availableInstances.map((item) => item.id);
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
    let validationWarning: string | null = null;
    let validationResults: WaContactValidationResult[] = [];
    try {
      const sessionIdForValidation = await resolveSessionId(validSessionIds[0]);
      const validation = phones.length
        ? await wacalls.validateContacts(sessionIdForValidation, phones, true, req.user!.userId)
        : { results: [] };
      validationResults = validation.results;
    } catch (err) {
      validationWarning = err instanceof Error
        ? `Campanha criada sem validacao online do WhatsApp: ${err.message}`
        : "Campanha criada sem validacao online do WhatsApp.";
      validationResults = phones.map((phone) => ({
        input: phone,
        phone,
        isOnWhatsApp: true,
      }));
    }

    const results = [
      ...invalidRows,
      ...validationResults.map((row) => {
        const source = byPhone.get(row.phone) || byPhone.get(normalizePhoneForCall(row.input));
        return {
          ...row,
          name: source?.name || row.pushName || row.businessName || "",
          email: source?.email || "",
          metadata: source?.metadata || {},
        };
      }),
    ];
    const validRows = results.filter((row) => row.isOnWhatsApp && row.phone);
    if (validRows.length === 0) {
      res.status(400).json({ error: "Nenhum contato com WhatsApp foi encontrado na lista" });
      return;
    }

    let aiWarning: string | null = null;
    let safetyNotes: string[] = [];
    let usage: any = null;
    let variants = fallbackVariants(objective, variantCount, links);
    try {
      const composed = await composeGroqVariants({ objective, tone, variantCount, links, mediaUrls, model });
      if (composed.variants.length > 0) {
        variants = composed.variants;
        safetyNotes = composed.safetyNotes;
        usage = composed.usage;
      }
    } catch (err) {
      aiWarning = err instanceof Error
        ? `Groq indisponivel, usando variacoes locais: ${err.message}`
        : "Groq indisponivel, usando variacoes locais.";
    }

    const selectedFunnel = funnelId
      ? await prisma.funnel.findFirst({
          where: { id: funnelId, tenantId: req.user!.tenantId },
          include: { stages: { orderBy: { order: "asc" }, take: 1 } },
        })
      : null;

    const created = await prisma.dialingCampaign.create({
      data: {
        tenantId: req.user!.tenantId,
        name: campaignName,
        description: objective.slice(0, 500),
        status: "draft",
        mode: "whatsapp_ai",
        sessionId: validSessionIds.join(","),
        intervalSeconds,
        dailyLimit,
        totalContacts: validRows.length,
        contacts: {
          create: validRows.map((row: any, index) => {
            const assignedSessionId = validSessionIds[index % validSessionIds.length];
            const variant = variants[index % variants.length];
            return {
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
                smartCampaign: {
                  objective,
                  tone,
                  provider: "groq",
                  model,
                  aiWarning,
                  validationWarning,
                  mediaUrls,
                  links,
                  funnelId: selectedFunnel?.id || null,
                  funnelName: selectedFunnel?.name || null,
                  entryStageId: selectedFunnel?.stages?.[0]?.id || null,
                  rotationStrategy,
                  assignedSessionId,
                  variantIndex: index % variants.length,
                  message: variant?.body || "",
                  variants,
                  safetyNotes,
                  usage,
                },
              },
            };
          }),
        },
      },
      select: { id: true, name: true, mode: true, status: true, totalContacts: true, dailyLimit: true, intervalSeconds: true },
    });

    res.json({
      campaign: created,
      warning: aiWarning || validationWarning,
      validationWarning,
      aiWarning,
      blueprint: {
        objective,
        tone,
        provider: "groq",
        model,
        variants,
        safetyNotes,
        mediaUrls,
        links,
        rotation: {
          strategy: rotationStrategy,
          instances: availableInstances.map((instance) => ({
            id: instance.id,
            name: instance.name,
            provider: instance.channel.provider,
            status: instance.status,
          })),
        },
      },
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
