import { Router, Request, Response } from "express";
import {
  getAllAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  executeAgent,
  getPublishedAgents,
} from "../lib/agent-engine.ts";
import { executeWorkflow, createWorkflow, getWorkflows, orchestrateWithAgents } from "../lib/orchestrator.ts";
import {
  addDocument,
  createKnowledgeBase,
  getKnowledgeBase,
  getAllKnowledgeBases,
  searchKnowledgeBase,
  removeDocument,
} from "../lib/knowledge-base.ts";
import { authMiddleware, optionalAuth } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";
import { validate, schemas } from "../middleware/validate.ts";
import { agentChatLimiter } from "../middleware/rate-limit.ts";

const router = Router();

// Agent CRUD
router.get("/", optionalAuth, async (_req: Request, res: Response) => {
  const agents = _req.user
    ? await getAllAgents(_req.user.tenantId)
    : await getPublishedAgents();
  res.json({ agents });
});

router.post("/",
  authMiddleware,
  requirePermission("agents", "manage"),
  validate(schemas.createAgent),
  async (req: Request, res: Response) => {
    const data = {
      ...req.body,
      tenantId: req.user!.tenantId,
      authorId: req.user!.userId,
      authorName: req.user!.email,
    };
    const agent = await createAgent(data);
    res.status(201).json({ agent });
  }
);

router.put("/:id",
  authMiddleware,
  requirePermission("agents", "manage"),
  validate(schemas.updateAgent),
  async (req: Request, res: Response) => {
    const agent = await updateAgent(req.params.id, req.body, req.user!.tenantId);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
    res.json({ agent });
  }
);

router.delete("/:id",
  authMiddleware,
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const deleted = await deleteAgent(req.params.id, req.user!.tenantId);
    if (!deleted) { res.status(404).json({ error: "Agent not found" }); return; }
    res.json({ success: true });
  }
);

// Chat with agent
router.post("/:id/chat",
  authMiddleware,
  requirePermission("agents", "manage"),
  agentChatLimiter,
  validate(schemas.agentChat),
  async (req: Request, res: Response) => {
    const { message, conversationId } = req.body;
    const agent = await getAgent(req.params.id, req.user!.tenantId);
    if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

    try {
      const result = await executeAgent(agent, message);
      res.json({
        response: result.response,
        conversationId: conversationId || `conv-${Date.now()}`,
        metadata: result.metadata,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro ao processar IA" });
    }
  }
);

// Multi-agent orchestrated chat
router.post("/orchestrate",
  authMiddleware,
  requirePermission("agents", "manage"),
  agentChatLimiter,
  validate(schemas.orchestrate),
  async (req: Request, res: Response) => {
    const { primaryAgentId, message, supportingAgentIds } = req.body;
    try {
      const allowedAgents = await getAllAgents(req.user!.tenantId);
      const allowedAgentIds = new Set(allowedAgents.map((agent: any) => agent.id));
      if (!allowedAgentIds.has(primaryAgentId) || (supportingAgentIds || []).some((id: string) => !allowedAgentIds.has(id))) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      const result = await orchestrateWithAgents(primaryAgentId, message, supportingAgentIds || [], undefined, { tenantId: req.user!.tenantId });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Workflows
router.get("/workflows/all", (_req: Request, res: Response) => {
  res.json({ workflows: getWorkflows() });
});

router.post("/workflows",
  authMiddleware,
  requirePermission("agents", "manage"),
  (req: Request, res: Response) => {
    const workflow = createWorkflow(req.body);
    res.status(201).json({ workflow });
  }
);

router.post("/workflows/:id/execute", async (req: Request, res: Response) => {
  const { input, context } = req.body;
  try {
    const result = await executeWorkflow(req.params.id, input, context);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Knowledge Base routes
router.get("/knowledge",
  authMiddleware,
  requirePermission("agents", "manage"),
  async (_req: Request, res: Response) => {
    const knowledgeBases = await getAllKnowledgeBases(_req.user!.tenantId);
    res.json({ knowledgeBases });
  }
);

router.post("/knowledge",
  authMiddleware,
  requirePermission("agents", "manage"),
  validate(schemas.createKnowledgeBase),
  async (req: Request, res: Response) => {
    const kb = await createKnowledgeBase(req.body.name, req.user!.tenantId);
    res.status(201).json({ knowledgeBase: kb });
  }
);

router.get("/knowledge/:id", async (req: Request, res: Response) => {
  const kb = await getKnowledgeBase(req.params.id);
  if (!kb) { res.status(404).json({ error: "Knowledge base not found" }); return; }
  res.json({ knowledgeBase: kb });
});

router.post("/knowledge/:id/documents",
  authMiddleware,
  requirePermission("agents", "manage"),
  validate(schemas.addDocument),
  async (req: Request, res: Response) => {
    const kb = await getKnowledgeBase(req.params.id);
    if (!kb) { res.status(404).json({ error: "Knowledge base not found" }); return; }
    const doc = await addDocument(req.params.id, req.body);
    if (!doc) { res.status(500).json({ error: "Failed to add document" }); return; }
    res.status(201).json({ document: doc });
  }
);

router.delete("/knowledge/:kbId/documents/:docId",
  authMiddleware,
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const deleted = await removeDocument(req.params.docId);
    if (!deleted) { res.status(404).json({ error: "Document not found" }); return; }
    res.json({ success: true });
  }
);

router.post("/knowledge/:id/search", async (req: Request, res: Response) => {
  const { query, maxResults } = req.body;
  const results = await searchKnowledgeBase(req.params.id, query, maxResults);
  res.json({ results });
});

router.get("/:id", optionalAuth, async (req: Request, res: Response) => {
  const agent = req.user
    ? await getAgent(req.params.id, req.user.tenantId)
    : await getAgent(req.params.id);
  if (!agent || (!req.user && !agent.isPublished)) { res.status(404).json({ error: "Agent not found" }); return; }
  res.json({ agent });
});

export default router;
