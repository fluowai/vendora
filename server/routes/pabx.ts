import { Router, Request, Response } from "express";
import prisma from "../lib/prisma.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { z } from "zod";

const router = Router();
router.use(authMiddleware);

function handleError(res: Response, err: unknown) {
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: "Dados inválidos", details: err.flatten().fieldErrors });
    return;
  }
  const message = err instanceof Error ? err.message : "Erro interno";
  res.status(500).json({ error: message });
}

// ===== EXTENSIONS (Ramais) =====

const extensionSchema = z.object({
  extension: z.string().min(1, "Número do ramal obrigatório").max(10),
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  status: z.enum(["active", "paused", "offline"]).optional(),
  ringTimeout: z.number().int().min(5).max(120).optional(),
  callLimit: z.number().int().min(1).max(10).optional(),
  mobile: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  voicemail: z.boolean().optional(),
});

router.get("/extensions", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const extensions = await prisma.pabxExtension.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        queueMembers: { include: { queue: { select: { id: true, name: true } } } },
      },
      orderBy: { extension: "asc" },
    });
    res.json({ extensions });
  } catch (err) { handleError(res, err); }
});

router.get("/extensions/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const ext = await prisma.pabxExtension.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        queueMembers: { include: { queue: { select: { id: true, name: true } } } },
      },
    });
    if (!ext) { res.status(404).json({ error: "Ramal não encontrado" }); return; }
    res.json({ extension: ext });
  } catch (err) { handleError(res, err); }
});

router.post("/extensions", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = extensionSchema.parse(req.body);

    const existing = await prisma.pabxExtension.findUnique({
      where: { tenantId_extension: { tenantId, extension: data.extension } },
    });
    if (existing) { res.status(409).json({ error: "Número de ramal já existe" }); return; }

    const ext = await prisma.pabxExtension.create({
      data: { tenantId, ...data },
      include: {
        user: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ extension: ext });
  } catch (err) { handleError(res, err); }
});

router.patch("/extensions/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = extensionSchema.partial().parse(req.body);

    const ext = await prisma.pabxExtension.findFirst({ where: { id: req.params.id, tenantId } });
    if (!ext) { res.status(404).json({ error: "Ramal não encontrado" }); return; }

    if (data.extension) {
      const dup = await prisma.pabxExtension.findUnique({
        where: { tenantId_extension: { tenantId, extension: data.extension } },
      });
      if (dup && dup.id !== req.params.id) { res.status(409).json({ error: "Número de ramal já existe" }); return; }
    }

    const updated = await prisma.pabxExtension.update({
      where: { id: req.params.id },
      data,
      include: {
        user: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    res.json({ extension: updated });
  } catch (err) { handleError(res, err); }
});

router.delete("/extensions/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const ext = await prisma.pabxExtension.findFirst({ where: { id: req.params.id, tenantId } });
    if (!ext) { res.status(404).json({ error: "Ramal não encontrado" }); return; }
    await prisma.pabxExtension.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// ===== QUEUES (Filas de Atendimento) =====

const queueSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional().nullable(),
  strategy: z.enum(["ringall", "leastrecent", "fewestcalls", "random"]).optional(),
  ringTimeout: z.number().int().min(5).max(120).optional(),
  maxWaitTime: z.number().int().min(30).max(3600).optional(),
  maxCallers: z.number().int().min(1).max(100).optional(),
  musicOnHold: z.string().optional().nullable(),
  welcomeMsg: z.string().optional().nullable(),
  status: z.enum(["active", "paused"]).optional(),
});

router.get("/queues", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const queues = await prisma.pabxQueue.findMany({
      where: { tenantId },
      include: {
        members: {
          include: {
            extension: {
              select: { id: true, extension: true, name: true, status: true },
            },
          },
          orderBy: { priority: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json({ queues });
  } catch (err) { handleError(res, err); }
});

router.post("/queues", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = queueSchema.parse(req.body);
    const queue = await prisma.pabxQueue.create({
      data: { tenantId, ...data },
      include: { members: true },
    });
    res.status(201).json({ queue });
  } catch (err) { handleError(res, err); }
});

router.patch("/queues/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = queueSchema.partial().parse(req.body);
    const queue = await prisma.pabxQueue.findFirst({ where: { id: req.params.id, tenantId } });
    if (!queue) { res.status(404).json({ error: "Fila não encontrada" }); return; }
    const updated = await prisma.pabxQueue.update({
      where: { id: req.params.id },
      data,
      include: {
        members: {
          include: { extension: { select: { id: true, extension: true, name: true } } },
        },
      },
    });
    res.json({ queue: updated });
  } catch (err) { handleError(res, err); }
});

router.delete("/queues/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const queue = await prisma.pabxQueue.findFirst({ where: { id: req.params.id, tenantId } });
    if (!queue) { res.status(404).json({ error: "Fila não encontrada" }); return; }
    await prisma.pabxQueue.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// Queue Members
router.post("/queues/:id/members", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const queue = await prisma.pabxQueue.findFirst({ where: { id: req.params.id, tenantId } });
    if (!queue) { res.status(404).json({ error: "Fila não encontrada" }); return; }

    const { extensionId, priority, timeout } = z.object({
      extensionId: z.string().uuid(),
      priority: z.number().int().optional().default(1),
      timeout: z.number().int().optional().default(30),
    }).parse(req.body);

    const ext = await prisma.pabxExtension.findFirst({ where: { id: extensionId, tenantId } });
    if (!ext) { res.status(404).json({ error: "Ramal não encontrado" }); return; }

    const member = await prisma.pabxQueueMember.create({
      data: { queueId: req.params.id, extensionId, priority, timeout },
      include: { extension: { select: { id: true, extension: true, name: true } } },
    });
    res.status(201).json({ member });
  } catch (err) { handleError(res, err); }
});

router.delete("/queues/:queueId/members/:memberId", async (req: Request, res: Response) => {
  try {
    const member = await prisma.pabxQueueMember.findFirst({
      where: { id: req.params.memberId, queueId: req.params.queueId },
    });
    if (!member) { res.status(404).json({ error: "Membro não encontrado" }); return; }
    await prisma.pabxQueueMember.delete({ where: { id: req.params.memberId } });
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// ===== IVR MENUS (URA) =====

const ivrSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional().nullable(),
  greeting: z.string().optional().nullable(),
  greetingType: z.enum(["text", "audio"]).optional(),
  timeout: z.number().int().min(3).max(60).optional(),
  timeoutDestType: z.enum(["extension", "queue", "ivr"]).optional().nullable(),
  timeoutDestId: z.string().optional().nullable(),
  invalidDestType: z.enum(["extension", "queue", "ivr"]).optional().nullable(),
  invalidDestId: z.string().optional().nullable(),
  language: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

router.get("/ivr", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const menus = await prisma.pabxIvrMenu.findMany({
      where: { tenantId },
      include: {
        options: { orderBy: { digit: "asc" } },
      },
      orderBy: { name: "asc" },
    });
    res.json({ menus });
  } catch (err) { handleError(res, err); }
});

router.post("/ivr", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = ivrSchema.parse(req.body);
    const menu = await prisma.pabxIvrMenu.create({
      data: { tenantId, ...data },
      include: { options: true },
    });
    res.status(201).json({ menu });
  } catch (err) { handleError(res, err); }
});

router.patch("/ivr/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = ivrSchema.partial().parse(req.body);
    const menu = await prisma.pabxIvrMenu.findFirst({ where: { id: req.params.id, tenantId } });
    if (!menu) { res.status(404).json({ error: "Menu IVR não encontrado" }); return; }
    const updated = await prisma.pabxIvrMenu.update({
      where: { id: req.params.id },
      data,
      include: { options: { orderBy: { digit: "asc" } } },
    });
    res.json({ menu: updated });
  } catch (err) { handleError(res, err); }
});

router.delete("/ivr/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const menu = await prisma.pabxIvrMenu.findFirst({ where: { id: req.params.id, tenantId } });
    if (!menu) { res.status(404).json({ error: "Menu IVR não encontrado" }); return; }
    await prisma.pabxIvrMenu.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// IVR Options
router.post("/ivr/:id/options", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const menu = await prisma.pabxIvrMenu.findFirst({ where: { id: req.params.id, tenantId } });
    if (!menu) { res.status(404).json({ error: "Menu IVR não encontrado" }); return; }

    const data = z.object({
      digit: z.string().regex(/^[0-9*#]$/, "Digito inválido"),
      description: z.string().optional().nullable(),
      destinationType: z.enum(["extension", "queue", "ivr"]),
      destinationId: z.string(),
    }).parse(req.body);

    const option = await prisma.pabxIvrOption.create({
      data: { ivrMenuId: req.params.id, ...data },
    });
    res.status(201).json({ option });
  } catch (err) { handleError(res, err); }
});

router.delete("/ivr/:menuId/options/:optionId", async (req: Request, res: Response) => {
  try {
    const option = await prisma.pabxIvrOption.findFirst({
      where: { id: req.params.optionId, ivrMenuId: req.params.menuId },
    });
    if (!option) { res.status(404).json({ error: "Opção não encontrada" }); return; }
    await prisma.pabxIvrOption.delete({ where: { id: req.params.optionId } });
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// ===== CALL ROUTES (Rotas de Chamada) =====

const routeSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional().nullable(),
  source: z.string().min(1, "Origem obrigatória"),
  destinationType: z.enum(["extension", "queue", "ivr", "voicemail"]),
  destinationId: z.string().optional().nullable(),
  ivrMenuId: z.string().uuid().optional().nullable(),
  priority: z.number().int().optional(),
  timeSchedule: z.any().optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

router.get("/routes", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const routes = await prisma.pabxCallRoute.findMany({
      where: { tenantId },
      include: {
        ivrMenu: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
    });
    res.json({ routes });
  } catch (err) { handleError(res, err); }
});

router.post("/routes", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = routeSchema.parse(req.body);
    const route = await prisma.pabxCallRoute.create({
      data: { tenantId, ...data },
      include: { ivrMenu: { select: { id: true, name: true } } },
    });
    res.status(201).json({ route });
  } catch (err) { handleError(res, err); }
});

router.patch("/routes/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const data = routeSchema.partial().parse(req.body);
    const route = await prisma.pabxCallRoute.findFirst({ where: { id: req.params.id, tenantId } });
    if (!route) { res.status(404).json({ error: "Rota não encontrada" }); return; }
    const updated = await prisma.pabxCallRoute.update({
      where: { id: req.params.id },
      data,
      include: { ivrMenu: { select: { id: true, name: true } } },
    });
    res.json({ route: updated });
  } catch (err) { handleError(res, err); }
});

router.delete("/routes/:id", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const route = await prisma.pabxCallRoute.findFirst({ where: { id: req.params.id, tenantId } });
    if (!route) { res.status(404).json({ error: "Rota não encontrada" }); return; }
    await prisma.pabxCallRoute.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) { handleError(res, err); }
});

// ===== PABX STATS =====

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const tenantId = req.user!.tenantId;
    const [totalExtensions, activeExtensions, totalQueues, activeIvrMenus, activeRoutes, recentCalls] = await Promise.all([
      prisma.pabxExtension.count({ where: { tenantId } }),
      prisma.pabxExtension.count({ where: { tenantId, status: "active" } }),
      prisma.pabxQueue.count({ where: { tenantId } }),
      prisma.pabxIvrMenu.count({ where: { tenantId, status: "active" } }),
      prisma.pabxCallRoute.count({ where: { tenantId, status: "active" } }),
      prisma.pabxCallLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    res.json({
      stats: {
        totalExtensions,
        activeExtensions,
        totalQueues,
        activeIvrMenus,
        activeRoutes,
      },
      recentCalls,
    });
  } catch (err) { handleError(res, err); }
});

export default router;
