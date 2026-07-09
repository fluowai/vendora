import { Router, Request, Response } from "express";
import { AVAILABLE_AGENT_TOOLS, executeAgentTool, type AgentToolName } from "../lib/agent-tools.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { requirePermission } from "../middleware/permissions.ts";

const router = Router();
router.use(authMiddleware);

router.get("/",
  requirePermission("agents", "manage"),
  async (_req: Request, res: Response) => {
    res.json({ tools: AVAILABLE_AGENT_TOOLS });
  },
);

router.post("/:name/execute",
  requirePermission("agents", "manage"),
  async (req: Request, res: Response) => {
    const result = await executeAgentTool({
      tenantId: req.user!.tenantId,
      userId: req.user!.userId,
      contactId: req.body.contactId,
      conversationId: req.body.conversationId,
      aiAgentId: req.body.aiAgentId,
      name: req.params.name as AgentToolName,
      args: req.body.args || {},
    });
    res.status(result.ok ? 200 : result.requiresApproval ? 409 : 400).json(result);
  },
);

export default router;
