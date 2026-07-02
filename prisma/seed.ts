import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ALL_PERMISSIONS = {
  admin: [
    { action: "tickets", subject: "read" },
    { action: "tickets", subject: "manage" },
    { action: "crm", subject: "read" },
    { action: "crm", subject: "manage" },
    { action: "ombudsman", subject: "read" },
    { action: "ombudsman", subject: "manage" },
    { action: "agents", subject: "manage" },
    { action: "channels", subject: "manage" },
    { action: "settings", subject: "read" },
    { action: "settings", subject: "write" },
    { action: "team", subject: "read" },
    { action: "team", subject: "manage" },
    { action: "reports", subject: "read" },
  ],
  supervisor: [
    { action: "tickets", subject: "read" },
    { action: "tickets", subject: "manage" },
    { action: "crm", subject: "read" },
    { action: "crm", subject: "manage" },
    { action: "ombudsman", subject: "read" },
    { action: "ombudsman", subject: "manage" },
    { action: "agents", subject: "read" },
    { action: "channels", subject: "read" },
    { action: "settings", subject: "read" },
    { action: "team", subject: "read" },
    { action: "reports", subject: "read" },
  ],
  agent: [
    { action: "tickets", subject: "read" },
    { action: "tickets", subject: "manage" },
    { action: "crm", subject: "read" },
    { action: "ombudsman", subject: "read" },
    { action: "agents", subject: "read" },
    { action: "reports", subject: "read" },
  ],
};

async function main() {
  console.log("Seeding database...");

  // ============= PLANS =============
  const plans = [
    { id: "free", name: "Starter", price: 0, maxAgents: 1, maxConversations: 500, maxChannels: 1, maxUsers: 1, features: ["1 agente de IA", "500 conversas/mês", "1 canal (Web Chat)", "Modelo Gemini Flash", "Relatórios básicos"] },
    { id: "growth", name: "Growth", price: 97, maxAgents: 5, maxConversations: 5000, maxChannels: 3, maxUsers: 10, features: ["5 agentes de IA", "5.000 conversas/mês", "Todos os canais", "Modelos Gemini + GPT", "Marketplace de agentes", "Base de conhecimento (RAG)", "Analytics avançado", "Suporte prioritário"] },
    { id: "pro", name: "Professional", price: 297, maxAgents: 999999, maxConversations: 50000, maxChannels: 999999, maxUsers: 50, features: ["Agentes ilimitados", "50.000 conversas/mês", "Todos os canais + API", "Todos os modelos (Gemini, GPT, Claude)", "Marketplace + Publicação", "Orquestrador multi-agente", "White-label", "Widget incorporável", "SLA 99.9%"] },
    { id: "enterprise", name: "Enterprise", price: 0, maxAgents: 999999, maxConversations: 99999999, maxChannels: 999999, maxUsers: 999999, features: ["Tudo do Pro +", "Conversas ilimitadas", "Infraestrutura dedicada", "Fine-tuning de modelos", "Agentes de voz", "Onboarding dedicado", "Contrato personalizado"] },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
    console.log(`  Plan: ${plan.name}`);
  }

  // ============= SUPERADMIN USER =============
  const superadminExists = await prisma.user.findUnique({ where: { email: "super@vendaora.com" } });
  if (!superadminExists) {
    const superadminTenant = await prisma.tenant.upsert({
      where: { slug: "vendaora-super" },
      update: {},
      create: {
        id: "superadmin-tenant",
        name: "Vendaora Super Admin",
        slug: "vendaora-super",
        email: "super@vendaora.com",
        planId: "enterprise",
      },
    });

    await prisma.user.create({
      data: {
        name: "Super Admin",
        email: "super@vendaora.com",
        passwordHash: await bcrypt.hash("super123", 12),
        tenantId: superadminTenant.id,
        isSuperadmin: true,
      },
    });
    console.log("  Superadmin user: super@vendaora.com / super123");
  } else {
    console.log("  Superadmin user already exists, skipping.");
  }

  // ============= DEMO TENANT =============
  let tenant = await prisma.tenant.findUnique({ where: { slug: "vendaora" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        id: "seed-tenant",
        name: "Vendaora AI",
        slug: "vendaora",
        email: "admin@vendaora.com",
        planId: "growth",
      },
    });
    console.log(`  Created tenant: ${tenant.name}`);
  }

  // ============= ROLES (always ensure they exist) =============
  const existingRoles = await prisma.role.findMany({ where: { tenantId: tenant.id } });
  const existingRoleNames = existingRoles.map((r) => r.name);
  let createdAdminRole: any;

  for (const [roleName, perms] of Object.entries(ALL_PERMISSIONS)) {
    if (existingRoleNames.includes(roleName)) {
      // Update permissions
      const role = existingRoles.find((r) => r.name === roleName)!;
      await prisma.permission.deleteMany({ where: { roleId: role.id } });
      await prisma.permission.createMany({
        data: perms.map((p) => ({ roleId: role.id, action: p.action, subject: p.subject })),
      });
      console.log(`    Updated role: ${roleName}`);
    } else {
      // Create role
      const role = await prisma.role.create({
        data: {
          tenantId: tenant.id,
          name: roleName,
          permissions: { create: perms },
        },
      });
      console.log(`    Created role: ${roleName}`);
    }
  }

  // ============= DEMO USERS (always ensure they exist) =============
  let adminUser = await prisma.user.findUnique({ where: { email: "admin@vendaora.com" } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: "Admin",
        email: "admin@vendaora.com",
        passwordHash: await bcrypt.hash("admin123", 12),
        tenantId: tenant.id,
      },
    });
    console.log(`  Created user: ${adminUser.email}`);
  }

  let agentUser = await prisma.user.findUnique({ where: { email: "joao@vendaora.com" } });
  if (!agentUser) {
    agentUser = await prisma.user.create({
      data: {
        name: "João Atendente",
        email: "joao@vendaora.com",
        passwordHash: await bcrypt.hash("joao123", 12),
        tenantId: tenant.id,
      },
    });
    console.log(`  Created user: ${agentUser.email}`);
  }

  // ============= ASSIGN ROLES (always ensure they exist) =============
  const adminRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "admin" } });
  if (adminRole) {
    const existingAdminRole = await prisma.userRole.findFirst({
      where: { userId: adminUser.id, roleId: adminRole.id },
    });
    if (!existingAdminRole) {
      await prisma.userRole.create({ data: { userId: adminUser.id, roleId: adminRole.id } });
      console.log(`  Assigned admin role to ${adminUser.email}`);
    }
  }

  const agentRole = await prisma.role.findFirst({ where: { tenantId: tenant.id, name: "agent" } });
  if (agentRole) {
    const existingAgentRole = await prisma.userRole.findFirst({
      where: { userId: agentUser.id, roleId: agentRole.id },
    });
    if (!existingAgentRole) {
      await prisma.userRole.create({ data: { userId: agentUser.id, roleId: agentRole.id } });
      console.log(`  Assigned agent role to ${agentUser.email}`);
    }
  }

  // ============= DEPARTMENTS (skip if exist) =============
  const existingDepts = await prisma.department.findMany({ where: { tenantId: tenant.id } });
  if (existingDepts.length === 0) {
    console.log("  Creating departments...");
    const departments = [
      { name: "Vendas" },
      { name: "Suporte Técnico" },
      { name: "Retenção / CS" },
      { name: "Financeiro" },
    ];
    for (const dept of departments) {
      await prisma.department.create({ data: { tenantId: tenant.id, name: dept.name } });
      console.log(`    Department: ${dept.name}`);
    }
  }

  // ============= AGENTS (skip if exist) =============
  const existingAgentCount = await prisma.aiAgent.count({ where: { tenantId: tenant.id } });
  if (existingAgentCount === 0) {
    console.log("  Creating seed agents...");
    const seedAgents = [
      {
        id: "agent-sdr-vendas", name: "SDR Vendas", segment: "vendas",
        description: "Especialista em qualificar leads que chegam pelos canais de entrada. Agenda reuniões e identifica o perfil do cliente ideal.",
        modelProvider: "gemini", modelName: "gemini-3-flash-preview", temperature: 0.7,
        basePrompt: "Seu foco é qualificar leads rapidamente. Faça perguntas estratégicas para entender dor, orçamento e urgência.",
        status: "active", channels: ["whatsapp", "instagram", "web"], isPublished: true, installs: 1240, rating: 4.8,
        tags: ["vendas", "qualificacao", "lead-generation"],
      },
      {
        id: "agent-suporte-tecnico", name: "Suporte Técnico", segment: "suporte",
        description: "Resolve dúvidas frequentes sobre produtos e serviços. Escala problemas complexos para a equipe humana.",
        modelProvider: "gemini", modelName: "gemini-3-pro-preview", temperature: 0.3,
        basePrompt: "Seja paciente e resolva o problema do cliente. Se não conseguir resolver, explique claramente e escale.",
        status: "active", channels: ["whatsapp", "instagram", "web", "email"], isPublished: true, installs: 856, rating: 4.6,
        tags: ["suporte", "helpdesk", "faq"],
      },
      {
        id: "agent-pos-venda", name: "Assistente Pós-Venda", segment: "retencao",
        description: "Entra em contato após a compra para garantir satisfação, pedir review e oferecer produtos complementares.",
        modelProvider: "gemini", modelName: "gemini-3-flash-preview", temperature: 0.8,
        basePrompt: "Seja gentil e acolhedor. O foco é satisfação do cliente e fidelização.",
        status: "paused", channels: ["whatsapp", "email"], isPublished: true, installs: 432, rating: 4.2,
        tags: ["pos-venda", "retencao", "nps"],
      },
      {
        id: "agent-triagem-saude", name: "Triagem Saúde", segment: "saude",
        description: "Realiza pré-triagem de pacientes, coleta sintomas e agenda consultas com o especialista adequado.",
        modelProvider: "gemini", modelName: "gemini-3-flash-preview", temperature: 0.4,
        basePrompt: "Você é um assistente de saúde. Mantenha tom profissional e ético. Nunca forneça diagnósticos definitivos.",
        status: "draft", channels: ["whatsapp", "web"], isPublished: true, installs: 234, rating: 4.5,
        tags: ["saude", "triagem", "agendamento"],
      },
      {
        id: "agent-assistente-juridico", name: "Assistente Jurídico", segment: "juridico",
        description: "Presta informações jurídicas iniciais, gera minutas de contratos simples e acompanha prazos processuais.",
        modelProvider: "gemini", modelName: "gemini-3-pro-preview", temperature: 0.3,
        basePrompt: "Você é um assistente jurídico. Use linguagem formal e precisa. Informe que não substitui um advogado.",
        status: "draft", channels: ["web", "email"], isPublished: true, installs: 187, rating: 4.3,
        tags: ["juridico", "contratos", "consultoria"],
      },
      {
        id: "agent-tutor-educacao", name: "Tutor Virtual", segment: "educacao",
        description: "Auxilia alunos com dúvidas de estudos, revisa conteúdos e sugere materiais de aprendizado complementares.",
        modelProvider: "openai", modelName: "gpt-4o-mini", temperature: 0.6,
        basePrompt: "Você é um tutor educacional. Seja paciente e didático. Adapte a explicação ao nível do aluno.",
        status: "active", channels: ["web", "whatsapp", "telegram"], isPublished: true, installs: 567, rating: 4.7,
        tags: ["educacao", "tutoria", "estudos"],
      },
      {
        id: "agent-corretor-imoveis", name: "Corretor Virtual", segment: "imobiliario",
        description: "Apresenta imóveis, agenda visitas, calcula financiamento e qualifica potenciais compradores.",
        modelProvider: "groq", modelName: "llama-3.3-70b-versatile", temperature: 0.8,
        basePrompt: "Você é um corretor virtual. Seja persuasivo mas honesto. Destaque os benefícios dos imóveis.",
        status: "draft", channels: ["whatsapp", "instagram", "web"], isPublished: true, installs: 345, rating: 4.4,
        tags: ["imoveis", "corretagem", "financiamento"],
      },
      {
        id: "agent-analista-financeiro", name: "Analista Financeiro", segment: "financeiro",
        description: "Analisa perfil de crédito, simula financiamentos, organiza orçamento pessoal e responde dúvidas sobre investimentos.",
        modelProvider: "anthropic", modelName: "claude-3-sonnet-20240229", temperature: 0.3,
        basePrompt: "Você é um analista financeiro. Seja conservador nas recomendações. Informe riscos. Nunca prometa retornos garantidos.",
        status: "draft", channels: ["web", "email", "whatsapp"], isPublished: true, installs: 178, rating: 4.1,
        tags: ["financeiro", "credito", "investimentos"],
      },
    ];

    for (const agent of seedAgents) {
      const existingAgentCheck = await prisma.aiAgent.findUnique({ where: { id: agent.id } });
      if (!existingAgentCheck) {
        await prisma.aiAgent.create({ data: { ...agent, tenantId: tenant.id, authorId: adminUser.id, authorName: adminUser.name } });
        console.log(`    Agent: ${agent.name}`);
      }
    }
  }

  console.log(`  Demo tenant: ${tenant.name}`);
  console.log(`  Admin: admin@vendaora.com / admin123`);
  console.log(`  Agent: joao@vendaora.com / joao123`);

  console.log("\nSeed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
