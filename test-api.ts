const BASE = "http://127.0.0.1:3333";
const results: any[] = [];

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}@vendora.com.br`;
}

async function req(method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: any }> {
  try {
    const response = await fetch(new URL(path, BASE), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: response.status, data: parsed };
  } catch (error: any) {
    return { status: 0, data: error?.message || "REQUEST_FAILED" };
  }
}

async function test(method: string, path: string, body?: any, token?: string, expected?: number | number[], desc?: string) {
  const response = await req(method, path, body, token);
  const accepted = Array.isArray(expected) ? expected : expected !== undefined ? [expected] : [];
  const pass = accepted.length > 0
    ? accepted.includes(response.status)
    : response.status >= 200 && response.status < 300;
  const icon = pass ? "OK" : "FAIL";
  const label = desc || `${method} ${path}`;

  console.log(`${icon} ${response.status} ${label}`);
  if (!pass) console.log(`  -> ${JSON.stringify(response.data).slice(0, 400)}`);

  results.push({ method, path, expected: accepted, status: response.status, pass, data: response.data, label });
  return { ...response, pass };
}

async function main() {
  const email = uniqueEmail("smoke");
  const password = "SmokeTest123!";

  console.log("\n=== AUTH ===");
  const register = await test("POST", "/api/auth/register", {
    email,
    password,
    name: "Smoke Test",
    company: "Smoke Co",
  }, undefined, 201, "Register tenant admin");

  let token = register.data?.token as string | undefined;
  await test("POST", "/api/auth/login", { email, password }, undefined, 200, "Login");
  await test("GET", "/api/auth/me", undefined, token, 200, "Current user");

  console.log("\n=== SUPERADMIN ===");
  const superadmin = await test("POST", "/api/auth/login", {
    email: "super@vendaora.com",
    password: "super123",
  }, undefined, 200, "Mega admin login");
  const saToken = superadmin.data?.token as string | undefined;
  await test("GET", "/api/superadmin/stats", undefined, saToken, 200, "Mega stats");
  await test("GET", "/api/superadmin/plans", undefined, saToken, 200, "Mega plans");
  await test("GET", "/api/superadmin/tenants", undefined, saToken, 200, "Mega tenants");
  await test("GET", "/api/superadmin/whitelabels", undefined, saToken, 200, "Mega whitelabels");

  console.log("\n=== CONVERSATIONS ===");
  await test("GET", "/api/conversations", undefined, token, 200, "List conversations");
  const conversation = await test("POST", "/api/conversations", {
    name: "Lead Smoke",
    phone: "11999999999",
    email: "lead-smoke@vendora.com.br",
    channel: "web",
    initialMessage: "Quero saber mais sobre o produto",
  }, token, [200, 201], "Create conversation");
  const conversationId = conversation.data?.conversation?.id;
  if (conversationId) {
    await test("GET", `/api/conversations/${conversationId}`, undefined, token, 200, "Get conversation");
    await test("PATCH", `/api/conversations/${conversationId}`, { status: "waiting" }, token, 200, "Update conversation");
  }

  console.log("\n=== TICKETS ===");
  await test("GET", "/api/tickets", undefined, token, 200, "List tickets");
  const ticket = await test("POST", "/api/tickets", {
    title: "Ticket Smoke",
    description: "Ticket criado pelo smoke test atual",
    priority: "normal",
    contactName: "Cliente Smoke",
    contactEmail: "cliente-smoke@vendora.com.br",
  }, token, 201, "Create ticket");
  if (ticket.data?.ticket?.id) {
    await test("GET", `/api/tickets/${ticket.data.ticket.id}`, undefined, token, 200, "Get ticket");
  }

  console.log("\n=== CRM ===");
  const funnel = await test("POST", "/api/crm/funnels", {
    name: "Funil Smoke",
    stages: [{ name: "Entrada", order: 0 }],
  }, token, 201, "Create funnel");
  await test("GET", "/api/crm/funnels", undefined, token, 200, "List funnels");
  const funnelId = funnel.data?.funnel?.id;
  const stageId = funnel.data?.funnel?.stages?.[0]?.id;
  if (funnelId) await test("GET", `/api/crm/stages/${funnelId}`, undefined, token, 200, "Get funnel stages");
  if (funnelId && stageId) {
    await test("POST", "/api/crm/deals", {
      title: "Deal Smoke",
      funnelId,
      stageId,
      value: 2500,
      contactName: "Lead CRM",
      contactEmail: "lead-crm@vendora.com.br",
    }, token, 201, "Create deal");
  }
  await test("GET", "/api/crm/deals", undefined, token, 200, "List deals");

  console.log("\n=== AGENTS ===");
  const agent = await test("POST", "/api/agents", {
    name: "Agente GLM Smoke",
    description: "Agente de validacao do provider GLM",
    segment: "vendas",
    status: "draft",
    llmConfig: {
      provider: "glm",
      model: "glm-4.5-air",
      temperature: 0.4,
      systemPrompt: "Voce e um agente de teste.",
    },
    channels: ["web"],
    tags: ["smoke", "glm"],
  }, token, 201, "Create agent with GLM");
  const agentId = agent.data?.agent?.id;
  await test("GET", "/api/agents", undefined, token, 200, "List agents");
  if (agentId) {
    await test("GET", `/api/agents/${agentId}`, undefined, token, 200, "Get agent");
    await test("POST", `/api/agents/${agentId}/chat`, {
      message: "Teste de integracao com GLM",
    }, token, 500, "Chat returns provider config error without GLM key");
  }

  console.log("\n=== KNOWLEDGE BASE ===");
  const kb = await test("POST", "/api/agents/knowledge", { name: "KB Smoke" }, token, 201, "Create knowledge base");
  await test("GET", "/api/agents/knowledge", undefined, token, 200, "List knowledge bases");
  const kbId = kb.data?.knowledgeBase?.id;
  if (kbId) {
    await test("POST", `/api/agents/knowledge/${kbId}/documents`, {
      name: "faq.txt",
      type: "txt",
      content: "Conteudo de smoke test para base de conhecimento.",
    }, token, 201, "Add KB document");
  }

  console.log("\n=== OMBUDSMAN ===");
  await test("GET", "/api/ombudsman/cases", undefined, token, 200, "List ombudsman cases");
  await test("POST", "/api/ombudsman/cases", {
    type: "reclamacao",
    category: "atendimento",
    description: "Descricao suficientemente longa para validar a criacao do caso.",
    priority: "normal",
    severity: "medium",
    anonymous: false,
    contactName: "Manifestante Smoke",
    contactEmail: "manifestante@vendora.com.br",
  }, token, 201, "Create ombudsman case");

  console.log("\n=== PABX ===");
  const extension = await test("POST", "/api/pabx/extensions", {
    extension: "1001",
    name: "Ramal Smoke",
    status: "active",
  }, token, [201, 409], "Create extension");
  const extensionId = extension.data?.extension?.id;
  await test("GET", "/api/pabx/extensions", undefined, token, 200, "List extensions");

  const queue = await test("POST", "/api/pabx/queues", {
    name: "Fila Smoke",
    strategy: "ringall",
    status: "active",
  }, token, 201, "Create queue");
  const queueId = queue.data?.queue?.id;
  await test("GET", "/api/pabx/queues", undefined, token, 200, "List queues");
  if (queueId && extensionId) {
    await test("POST", `/api/pabx/queues/${queueId}/members`, {
      extensionId,
      priority: 1,
      timeout: 30,
    }, token, 201, "Add queue member");
  }

  const ivr = await test("POST", "/api/pabx/ivr", {
    name: "IVR Smoke",
    greeting: "Bem-vindo",
    status: "active",
  }, token, 201, "Create IVR");
  const ivrId = ivr.data?.menu?.id;
  await test("GET", "/api/pabx/ivr", undefined, token, 200, "List IVRs");
  if (ivrId && queueId) {
    await test("POST", `/api/pabx/ivr/${ivrId}/options`, {
      digit: "1",
      destinationType: "queue",
      destinationId: queueId,
    }, token, 201, "Add IVR option");
  }

  await test("POST", "/api/pabx/routes", {
    name: "Rota Smoke",
    source: "5511999999999",
    destinationType: "ivr",
    destinationId: ivrId || null,
    priority: 1,
    status: "active",
  }, token, 201, "Create call route");
  await test("GET", "/api/pabx/routes", undefined, token, 200, "List call routes");
  await test("GET", "/api/pabx/stats", undefined, token, 200, "PABX stats");

  console.log("\n=== FLOWS ===");
  await test("GET", "/api/flows", undefined, token, 200, "List flows");
  await test("POST", "/api/flows", {
    name: "Fluxo Smoke",
    description: "Fluxo de validacao",
    nodes: [{ id: "start", type: "start", data: {}, x: 0, y: 0 }],
    edges: [],
  }, token, 201, "Create flow");

  console.log("\n=== CALENDAR ===");
  await test("GET", "/api/calendar/calendars", undefined, token, 200, "List calendars");
  const slots = await test("GET", "/api/calendar/slots", undefined, token, 200, "List available slots");
  await test("GET", "/api/calendar/appointments", undefined, token, 200, "List appointments");
  const startsAt = slots.data?.slots?.[0] || new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  await test("POST", "/api/calendar/appointments", {
    title: "Reuniao Smoke",
    description: "Agendamento criado pelo smoke test",
    startsAt,
    durationMinutes: 30,
  }, token, 201, "Create appointment");

  console.log("\n=== MAILING ===");
  await test("GET", "/api/mailing/campaigns", undefined, token, 200, "List campaigns");

  console.log("\n=== ADMIN & ANALYTICS ===");
  await test("GET", "/api/admin/team", undefined, token, 200, "Team");
  await test("GET", "/api/admin/roles", undefined, token, 200, "Roles");
  await test("GET", "/api/analytics/overview", undefined, token, 200, "Analytics overview");
  await test("GET", "/api/analytics/daily", undefined, token, 200, "Analytics daily");
  await test("GET", "/api/analytics/agents", undefined, token, 200, "Analytics agents");
  await test("GET", "/api/analytics/team", undefined, token, 200, "Analytics team");

  console.log("\n=== INTEGRATIONS ===");
  await test("GET", "/api/integrations/status", undefined, token, 200, "Integration status");
  await test("GET", "/api/integrations/connections", undefined, token, 200, "Integration connections");
  await test("GET", "/api/calls/bridge/status", undefined, token, 200, "Calls bridge status");

  console.log("\n=== SUMMARY ===");
  const passed = results.filter((item) => item.pass).length;
  const failed = results.filter((item) => !item.pass);
  console.log(`Total: ${results.length} | Pass: ${passed} | Fail: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFAILED TESTS:");
    for (const item of failed) {
      console.log(`- ${item.label}: ${item.status}`);
      console.log(`  ${JSON.stringify(item.data).slice(0, 300)}`);
    }
  }

  const fs = await import("fs");
  fs.writeFileSync("C:/Users/paulo/vendora/test-results.json", JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
