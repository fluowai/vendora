import prisma from "./prisma.ts";
import { executeAgentTool, type AgentToolName } from "./agent-tools.ts";
import { executeAgent, getAgent } from "./agent-engine.ts";
import { emitToConversation, emitToTenant } from "./socket.ts";

type FlowNode = {
  id: string
  type: "message" | "question" | "condition" | "agent" | "tool" | "handoff" | "end" | string
  data?: Record<string, any>
}

type FlowEdge = {
  id?: string
  source: string
  target: string
  condition?: Record<string, any>
}

type FlowGraph = {
  startNodeId?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

type FlowValidationResult = { ok: true } | { ok: false; error: string }

type ExecuteFlowInput = {
  tenantId: string
  flowId?: string
  runId?: string
  conversationId?: string
  contactId?: string
  input?: string
}

function safeGraph(graph: any): FlowGraph {
  return {
    startNodeId: graph?.startNodeId,
    nodes: Array.isArray(graph?.nodes) ? graph.nodes : [],
    edges: Array.isArray(graph?.edges) ? graph.edges : [],
  };
}

export function validateFlowGraph(graph: any): FlowValidationResult {
  const parsed = safeGraph(graph);
  if (parsed.nodes.length === 0) return { ok: false, error: "Fluxo precisa ter pelo menos um no" };
  const ids = new Set<string>();
  for (const node of parsed.nodes) {
    if (!node.id || typeof node.id !== "string") return { ok: false, error: "Todo no precisa de id" };
    if (ids.has(node.id)) return { ok: false, error: `No duplicado: ${node.id}` };
    ids.add(node.id);
    if (!node.type || typeof node.type !== "string") return { ok: false, error: `No ${node.id} precisa de tipo` };
  }
  const start = parsed.startNodeId || parsed.nodes[0]?.id;
  if (!start || !ids.has(start)) return { ok: false, error: "No inicial invalido" };
  for (const edge of parsed.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      return { ok: false, error: `Aresta invalida: ${edge.source} -> ${edge.target}` };
    }
  }
  return { ok: true };
}

function interpolate(template: string, variables: Record<string, any>) {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => {
    const value = key.split(".").reduce((acc: any, part: string) => acc?.[part], variables);
    return value == null ? "" : String(value);
  });
}

function evaluateCondition(condition: any, variables: Record<string, any>, input?: string) {
  if (!condition) return true;
  const left = condition.variable === "input"
    ? input
    : String(condition.variable || "").split(".").reduce((acc: any, part: string) => acc?.[part], variables);
  const right = condition.value;
  const operator = condition.operator || "equals";

  if (operator === "not_equals") return String(left ?? "") !== String(right ?? "");
  if (operator === "contains") return String(left || "").toLowerCase().includes(String(right || "").toLowerCase());
  if (operator === "not_contains") return !String(left || "").toLowerCase().includes(String(right || "").toLowerCase());
  if (operator === "exists") return left != null && left !== "";
  if (operator === "not_exists") return left == null || left === "";
  if (operator === "not_equals") return String(left) !== String(right);
  return String(left) === String(right);
}

function nextNodeId(graph: FlowGraph, nodeId: string, variables: Record<string, any>, input?: string) {
  const edges = graph.edges.filter((edge) => edge.source === nodeId);
  const matched = edges.find((edge) => evaluateCondition(edge.condition, variables, input));
  return matched?.target || edges[0]?.target || null;
}

async function createFlowMessage(input: {
  tenantId: string
  conversationId?: string | null
  senderId: string
  content: string
}) {
  if (!input.conversationId || !input.content.trim()) return null;

  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, tenantId: input.tenantId },
  });
  if (!conversation) return null;

  const now = new Date();
  const message = await prisma.message.create({
    data: {
      tenantId: input.tenantId,
      conversationId: conversation.id,
      senderType: "agent",
      senderId: input.senderId,
      channel: conversation.channel,
      messageType: "text",
      content: input.content,
      sentAt: now,
      metadata: { source: "flow" } as any,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now },
  });

  emitToConversation(conversation.id, "message:new", {
    conversationId: conversation.id,
    message,
  });
  emitToTenant(input.tenantId, "conversation:updated", {
    conversationId: conversation.id,
    lastMessage: input.content,
    lastMessageAt: now,
  });

  return message;
}

async function getPublishedVersion(flowId: string) {
  const flow = await (prisma as any).agentFlow.findUnique({ where: { id: flowId } });
  if (!flow) return null;
  if (flow.publishedVersionId) {
    return (prisma as any).flowVersion.findFirst({
      where: { id: flow.publishedVersionId, flowId },
    });
  }
  return (prisma as any).flowVersion.findFirst({
    where: { flowId, status: "published" },
    orderBy: { version: "desc" },
  });
}

export async function listFlows(tenantId: string) {
  return (prisma as any).agentFlow.findMany({
    where: { tenantId },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getFlow(id: string, tenantId: string) {
  return (prisma as any).agentFlow.findFirst({
    where: { id, tenantId },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });
}

export async function createFlow(tenantId: string, data: any, userId?: string) {
  const graph = data.graph || {
    startNodeId: "start",
    nodes: [{ id: "start", type: "message", data: { text: "Ola! Como posso ajudar?" } }],
    edges: [],
  };
  const validation = validateFlowGraph(graph);
  if (validation.ok === false) throw new Error(validation.error);

  return (prisma as any).agentFlow.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      status: data.status || "draft",
      trigger: data.trigger || "manual",
      channel: data.channel,
      publicEnabled: data.publicEnabled === true,
      metadata: data.metadata,
      versions: {
        create: {
          version: 1,
          status: "draft",
          graph,
          createdBy: userId,
        },
      },
    },
    include: { versions: true },
  });
}

export async function updateFlow(id: string, tenantId: string, data: any) {
  return (prisma as any).agentFlow.updateMany({
    where: { id, tenantId },
    data: {
      name: data.name,
      description: data.description,
      status: data.status,
      trigger: data.trigger,
      channel: data.channel,
      publicEnabled: typeof data.publicEnabled === "boolean" ? data.publicEnabled : undefined,
      metadata: data.metadata,
    },
  });
}

export async function createFlowVersion(flowId: string, tenantId: string, graph: any, userId?: string) {
  const validation = validateFlowGraph(graph);
  if (validation.ok === false) throw new Error(validation.error);
  const flow = await getFlow(flowId, tenantId);
  if (!flow) return null;
  const latest = flow.versions?.[0]?.version || 0;
  return (prisma as any).flowVersion.create({
    data: {
      flowId,
      version: latest + 1,
      status: "draft",
      graph,
      createdBy: userId,
    },
  });
}

export async function publishFlowVersion(flowId: string, versionId: string, tenantId: string) {
  const flow = await getFlow(flowId, tenantId);
  if (!flow) return null;
  const version = await (prisma as any).flowVersion.findFirst({
    where: { id: versionId, flowId },
  });
  if (!version) return null;

  await (prisma as any).flowVersion.updateMany({
    where: { flowId, status: "published" },
    data: { status: "archived" },
  });
  await (prisma as any).flowVersion.update({
    where: { id: versionId },
    data: { status: "published", publishedAt: new Date() },
  });
  return (prisma as any).agentFlow.update({
    where: { id: flowId },
    data: { status: "active", publishedVersionId: versionId },
  });
}

export async function findWaitingRun(tenantId: string, conversationId: string) {
  return (prisma as any).flowRun.findFirst({
    where: { tenantId, conversationId, status: "waiting_input" },
    orderBy: { updatedAt: "desc" },
    include: { version: true },
  });
}

export async function findActiveMessageFlow(tenantId: string, channel?: string | null) {
  return (prisma as any).agentFlow.findFirst({
    where: {
      tenantId,
      status: "active",
      trigger: "new_message",
      OR: [
        { channel: null },
        { channel: "" },
        ...(channel ? [{ channel }] : []),
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function executeFlow(input: ExecuteFlowInput) {
  let run = input.runId
    ? await (prisma as any).flowRun.findFirst({
        where: { id: input.runId, tenantId: input.tenantId },
        include: { version: true },
      })
    : null;

  if (!run && input.conversationId) {
    run = await findWaitingRun(input.tenantId, input.conversationId);
  }

  if (!run) {
    if (!input.flowId) throw new Error("flowId ou runId e obrigatorio");
    const version = await getPublishedVersion(input.flowId);
    if (!version) throw new Error("Fluxo sem versao publicada");
    const graph = safeGraph(version.graph);
    run = await (prisma as any).flowRun.create({
      data: {
        tenantId: input.tenantId,
        flowId: input.flowId,
        versionId: version.id,
        conversationId: input.conversationId,
        contactId: input.contactId,
        status: "running",
        currentNodeId: graph.startNodeId || graph.nodes[0]?.id || null,
        variables: {},
        lastInput: input.input,
      },
      include: { version: true },
    });
  }

  const graph = safeGraph(run.version.graph);
  const variables = { ...(run.variables || {}) };
  const outputs: { nodeId: string; type: string; content?: string; metadata?: any }[] = [];
  let currentNodeId = run.currentNodeId || graph.startNodeId || graph.nodes[0]?.id || null;

  if (run.status === "waiting_input" && currentNodeId && input.input) {
    const waitingNode = graph.nodes.find((node) => node.id === currentNodeId);
    const variable = waitingNode?.data?.variable || waitingNode?.id;
    variables[variable] = input.input;
    await (prisma as any).flowRunStep.create({
      data: {
        runId: run.id,
        nodeId: currentNodeId,
        nodeType: waitingNode?.type || "question",
        input: { text: input.input },
        output: { variable, value: input.input },
      },
    });
    currentNodeId = nextNodeId(graph, currentNodeId, variables, input.input);
  }

  for (let guard = 0; guard < 20 && currentNodeId; guard += 1) {
    const node = graph.nodes.find((item) => item.id === currentNodeId);
    if (!node) throw new Error(`No ${currentNodeId} nao encontrado`);

    if (node.type === "message" || node.type === "end") {
      const text = interpolate(node.data?.text || "", variables);
      if (text) {
        outputs.push({ nodeId: node.id, type: node.type, content: text });
        await createFlowMessage({
          tenantId: input.tenantId,
          conversationId: run.conversationId,
          senderId: run.flowId,
          content: text,
        });
      }
      await (prisma as any).flowRunStep.create({
        data: { runId: run.id, nodeId: node.id, nodeType: node.type, output: { text } },
      });
      if (node.type === "end") {
        await (prisma as any).flowRun.update({
          where: { id: run.id },
          data: { status: "completed", currentNodeId: null, variables, completedAt: new Date() },
        });
        return { runId: run.id, status: "completed", outputs, variables };
      }
      currentNodeId = nextNodeId(graph, node.id, variables, input.input);
      continue;
    }

    if (node.type === "question") {
      const text = interpolate(node.data?.text || "Pode me responder?", variables);
      outputs.push({ nodeId: node.id, type: node.type, content: text });
      await createFlowMessage({
        tenantId: input.tenantId,
        conversationId: run.conversationId,
        senderId: run.flowId,
        content: text,
      });
      await (prisma as any).flowRunStep.create({
        data: { runId: run.id, nodeId: node.id, nodeType: node.type, output: { text }, status: "waiting_input" },
      });
      await (prisma as any).flowRun.update({
        where: { id: run.id },
        data: { status: "waiting_input", currentNodeId: node.id, variables, lastInput: input.input },
      });
      return { runId: run.id, status: "waiting_input", outputs, variables };
    }

    if (node.type === "agent") {
      const agent = await getAgent(node.data?.agentId);
      if (!agent) throw new Error(`Agente ${node.data?.agentId} nao encontrado`);
      const prompt = interpolate(node.data?.prompt || input.input || "", variables);
      const result = await executeAgent(agent, prompt || input.input || "", [], {
        tenantId: input.tenantId,
        contactId: run.contactId,
        conversationId: run.conversationId,
      });
      variables[node.data?.variable || "agentResponse"] = result.response;
      outputs.push({ nodeId: node.id, type: node.type, content: result.response, metadata: result.metadata });
      await createFlowMessage({
        tenantId: input.tenantId,
        conversationId: run.conversationId,
        senderId: agent.id,
        content: result.response,
      });
      await (prisma as any).flowRunStep.create({
        data: {
          runId: run.id,
          nodeId: node.id,
          nodeType: node.type,
          input: { prompt },
          output: { text: result.response, metadata: result.metadata },
        },
      });
      currentNodeId = nextNodeId(graph, node.id, variables, input.input);
      continue;
    }

    if (node.type === "tool") {
      const args = { ...(node.data?.args || {}) };
      for (const [key, value] of Object.entries(args)) {
        if (typeof value === "string") args[key] = interpolate(value, variables);
      }
      const toolResult = await executeAgentTool({
        tenantId: input.tenantId,
        contactId: run.contactId,
        conversationId: run.conversationId,
        name: node.data?.toolName as AgentToolName,
        args,
      });
      const variable = node.data?.variable || `${node.data?.toolName || "tool"}Result`;
      variables[variable] = toolResult;
      outputs.push({ nodeId: node.id, type: node.type, metadata: toolResult });
      await (prisma as any).flowRunStep.create({
        data: {
          runId: run.id,
          nodeId: node.id,
          nodeType: node.type,
          input: { toolName: node.data?.toolName, args },
          output: toolResult as any,
          status: toolResult.ok ? "completed" : "failed",
        },
      });
      if (!toolResult.ok && node.data?.stopOnError !== false) {
        await (prisma as any).flowRun.update({
          where: { id: run.id },
          data: {
            status: toolResult.requiresApproval ? "waiting_input" : "failed",
            currentNodeId: node.id,
            variables,
            lastError: toolResult.error,
          },
        });
        return { runId: run.id, status: toolResult.requiresApproval ? "waiting_input" : "failed", outputs, variables, error: toolResult.error };
      }
      currentNodeId = nextNodeId(graph, node.id, variables, input.input);
      continue;
    }

    if (node.type === "condition") {
      await (prisma as any).flowRunStep.create({
        data: { runId: run.id, nodeId: node.id, nodeType: node.type, output: { variables } },
      });
      currentNodeId = nextNodeId(graph, node.id, variables, input.input);
      continue;
    }

    if (node.type === "handoff") {
      if (run.conversationId) {
        await prisma.conversation.update({
          where: { id: run.conversationId },
          data: {
            aiEnabled: false,
            status: "pending_human",
            departmentId: node.data?.departmentId || undefined,
          },
        });
      }
      await (prisma as any).flowRunStep.create({
        data: { runId: run.id, nodeId: node.id, nodeType: node.type, output: { reason: node.data?.reason } },
      });
      await (prisma as any).flowRun.update({
        where: { id: run.id },
        data: { status: "completed", currentNodeId: null, variables, completedAt: new Date() },
      });
      return { runId: run.id, status: "completed", handoff: true, outputs, variables };
    }

    await (prisma as any).flowRunStep.create({
      data: { runId: run.id, nodeId: node.id, nodeType: node.type, status: "failed", output: { error: "Tipo de no nao suportado" } },
    });
    throw new Error(`Tipo de no nao suportado: ${node.type}`);
  }

  await (prisma as any).flowRun.update({
    where: { id: run.id },
    data: { status: "completed", currentNodeId: null, variables, completedAt: new Date() },
  });
  return { runId: run.id, status: "completed", outputs, variables };
}
