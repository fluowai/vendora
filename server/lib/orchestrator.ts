import { Message, Workflow } from "../../src/types/index.ts";
import { executeAgent, getAgent, type AgentRuntimeContext } from "./agent-engine.ts";

interface OrchestrationResult {
  finalResponse: string
  steps: {
    agentId: string
    agentName: string
    input: string
    output: string
  }[]
}

const workflows = new Map<string, Workflow>();

export function createWorkflow(workflow: Workflow): Workflow {
  workflows.set(workflow.id, workflow);
  return workflow;
}

export function getWorkflows(): Workflow[] {
  return Array.from(workflows.values());
}

export async function orchestrateWithAgents(
  primaryAgentId: string,
  message: string,
  supportingAgentIds: string[],
  history?: Message[],
  runtimeContext?: AgentRuntimeContext,
): Promise<OrchestrationResult> {
  const steps: OrchestrationResult["steps"] = [];
  const primaryAgent = await getAgent(primaryAgentId, runtimeContext?.tenantId);
  if (!primaryAgent) throw new Error(`Agent ${primaryAgentId} not found`);

  const primaryResult = await executeAgent(primaryAgent, message, history, runtimeContext);
  steps.push({
    agentId: primaryAgent.id,
    agentName: primaryAgent.name,
    input: message,
    output: primaryResult.response,
  });

  let needsSupport = false;
  const supportTriggers = [
    "precisa de ajuda", "encaminhar", "transferir", "especialista",
    "não sei", "não posso", "fora da minha alçada",
  ];

  const lowerResponse = primaryResult.response.toLowerCase();
  needsSupport = supportTriggers.some((t) => lowerResponse.includes(t));

  if (needsSupport && supportingAgentIds.length > 0) {
    for (const agentId of supportingAgentIds) {
      const agent = await getAgent(agentId, runtimeContext?.tenantId);
      if (!agent || agent.status !== "active") continue;

      const supportResult = await executeAgent(
        agent,
        `Assunto recebido do agente ${primaryAgent.name}: "${message}"\n\nContexto: ${primaryResult.response}`,
        history,
        runtimeContext,
      );
      steps.push({
        agentId: agent.id,
        agentName: agent.name,
        input: `Encaminhado de ${primaryAgent.name}: ${message}`,
        output: supportResult.response,
      });
    }
  }

  const lastStep = steps[steps.length - 1];
  return {
    finalResponse: lastStep.output,
    steps,
  };
}

export async function executeWorkflow(workflowId: string, input: string, context?: Record<string, any>): Promise<OrchestrationResult> {
  const workflow = workflows.get(workflowId);
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const steps: OrchestrationResult["steps"] = [];
  let currentInput = input;

  for (const step of workflow.steps) {
    const agent = await getAgent(step.agentId, context?.tenantId);
    if (!agent || agent.status !== "active") continue;

    if (step.condition) {
      try {
        const conditionStr = String(step.condition).toLowerCase();
        const conditions = conditionStr.split("&&").map((c: string) => c.trim());
        let conditionMet = true;
        for (const cond of conditions) {
          if (cond === "true") continue;
          if (cond === "false") { conditionMet = false; break; }
          if (cond.startsWith("input.includes(")) {
            const val = cond.slice(15, -2);
            if (!currentInput.toLowerCase().includes(val.toLowerCase())) { conditionMet = false; break; }
          } else if (cond.startsWith("context.")) {
            const key = cond.slice(8).replace(/^\[|('|")|]$/g, "");
            if (!context?.[key]) { conditionMet = false; break; }
          }
        }
        if (!conditionMet) continue;
      } catch {
        continue;
      }
    }

    const result = await executeAgent(agent, currentInput, undefined, context);
    steps.push({
      agentId: agent.id,
      agentName: agent.name,
      input: currentInput,
      output: result.response,
    });

    const actionStep = step.actions.find((a) => a.type === "send_message");
    if (actionStep) {
      currentInput = result.response;
    }
  }

  return {
    finalResponse: steps[steps.length - 1]?.output || input,
    steps,
  };
}
