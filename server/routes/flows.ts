import { Router, Request, Response } from "express";
import {
  createFlow,
  createFlowVersion,
  executeFlow,
  getFlow,
  listFlows,
  publishFlowVersion,
  updateFlow,
} from "../lib/flow-engine.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";

const router = Router();

router.use(authMiddleware);

router.get("/",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const flows = await listFlows(req.user!.tenantId);
    res.json({ flows });
  },
);

router.post("/",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Nome do fluxo e obrigatorio" });
      return;
    }
    try {
      const flow = await createFlow(req.user!.tenantId, req.body, req.user!.userId);
      res.status(201).json({ flow });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Fluxo invalido" });
    }
  },
);

router.get("/:id",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const flow = await getFlow(req.params.id, req.user!.tenantId);
    if (!flow) {
      res.status(404).json({ error: "Fluxo nao encontrado" });
      return;
    }
    res.json({ flow });
  },
);

router.get("/:id/runs",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const flow = await getFlow(req.params.id, req.user!.tenantId);
    if (!flow) {
      res.status(404).json({ error: "Fluxo nao encontrado" });
      return;
    }
    const runs = await (await import("../lib/prisma.ts")).default.flowRun.findMany({
      where: { flowId: req.params.id, tenantId: req.user!.tenantId },
      include: {
        contact: { select: { id: true, name: true, phone: true, email: true } },
        conversation: { select: { id: true, channel: true, status: true } },
        steps: { orderBy: { createdAt: "asc" }, take: 20 },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    });
    res.json({ runs });
  },
);

router.get("/:id/analytics",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const prisma = (await import("../lib/prisma.ts")).default;
    const flow = await getFlow(req.params.id, req.user!.tenantId);
    if (!flow) {
      res.status(404).json({ error: "Fluxo nao encontrado" });
      return;
    }
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const [total, completed, waitingInput, failed, recentRuns, stepCounts] = await Promise.all([
      prisma.flowRun.count({ where: { flowId: req.params.id, tenantId: req.user!.tenantId } }),
      prisma.flowRun.count({ where: { flowId: req.params.id, tenantId: req.user!.tenantId, status: "completed" } }),
      prisma.flowRun.count({ where: { flowId: req.params.id, tenantId: req.user!.tenantId, status: "waiting_input" } }),
      prisma.flowRun.count({ where: { flowId: req.params.id, tenantId: req.user!.tenantId, status: "failed" } }),
      prisma.flowRun.count({ where: { flowId: req.params.id, tenantId: req.user!.tenantId, startedAt: { gte: since } } }),
      prisma.flowRunStep.groupBy({
        by: ["nodeType"],
        where: { run: { flowId: req.params.id, tenantId: req.user!.tenantId } },
        _count: { nodeType: true },
      }),
    ]);
    res.json({
      analytics: {
        total,
        completed,
        waitingInput,
        failed,
        recentRuns,
        completionRate: total ? completed / total : 0,
        failureRate: total ? failed / total : 0,
        stepCounts: stepCounts.map((item) => ({ nodeType: item.nodeType, count: item._count.nodeType })),
      },
    });
  },
);

router.patch("/:id",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const result = await updateFlow(req.params.id, req.user!.tenantId, req.body);
    if (!result.count) {
      res.status(404).json({ error: "Fluxo nao encontrado" });
      return;
    }
    const flow = await getFlow(req.params.id, req.user!.tenantId);
    res.json({ flow });
  },
);

router.post("/:id/versions",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    if (!req.body?.graph) {
      res.status(400).json({ error: "graph e obrigatorio" });
      return;
    }
    let version = null;
    try {
      version = await createFlowVersion(req.params.id, req.user!.tenantId, req.body.graph, req.user!.userId);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Grafo invalido" });
      return;
    }
    if (!version) {
      res.status(404).json({ error: "Fluxo nao encontrado" });
      return;
    }
    res.status(201).json({ version });
  },
);

router.post("/:id/versions/:versionId/publish",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const flow = await publishFlowVersion(req.params.id, req.params.versionId, req.user!.tenantId);
    if (!flow) {
      res.status(404).json({ error: "Fluxo ou versao nao encontrado" });
      return;
    }
    res.json({ flow });
  },
);

router.post("/:id/execute",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    try {
      const result = await executeFlow({
        tenantId: req.user!.tenantId,
        flowId: req.params.id,
        conversationId: req.body.conversationId,
        contactId: req.body.contactId,
        input: req.body.input,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao executar fluxo" });
    }
  },
);

router.post("/runs/:runId/continue",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    try {
      const result = await executeFlow({
        tenantId: req.user!.tenantId,
        runId: req.params.runId,
        input: req.body.input,
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao continuar fluxo" });
    }
  },
);

export default router;
