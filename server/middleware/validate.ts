import { Request, Response, NextFunction } from "express";
import { z, ZodSchema } from "zod";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      res.status(400).json({
        error: "Dados inválidos",
        details: fieldErrors,
      });
      return;
    }
    if (source === "body") req.body = result.data;
    next();
  };
}

export const schemas = {
  createAgent: z.object({
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
    segment: z.enum(["vendas", "suporte", "retencao", "saude", "juridico", "educacao", "imobiliario", "financeiro", "rh", "logistica", "ecommerce"]),
    status: z.enum(["active", "paused", "draft"]).optional(),
    llmConfig: z.object({
      provider: z.enum(["gemini", "openai", "anthropic", "groq", "glm", "custom"]),
      model: z.string().min(1),
      temperature: z.number().min(0).max(2).optional(),
      systemPrompt: z.string().optional(),
      maxTokens: z.number().int().positive().optional(),
    }),
    channels: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    knowledgeBaseId: z.string().uuid().optional(),
    handoffRules: z.any().optional(),
  }),

  updateAgent: z.object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    segment: z.enum(["vendas", "suporte", "retencao", "saude", "juridico", "educacao", "imobiliario", "financeiro", "rh", "logistica", "ecommerce"]).optional(),
    status: z.enum(["active", "paused", "draft"]).optional(),
    llmConfig: z.object({
      provider: z.enum(["gemini", "openai", "anthropic", "groq", "glm", "custom"]),
      model: z.string().min(1),
      temperature: z.number().min(0).max(2).optional(),
      systemPrompt: z.string().optional(),
      maxTokens: z.number().int().positive().optional(),
    }).optional(),
    channels: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    knowledgeBaseId: z.string().uuid().nullable().optional(),
    handoffRules: z.any().optional(),
  }),

  login: z.object({
    email: z.string().email("Email inválido"),
    password: z.string().min(1, "Senha obrigatória"),
  }),

  register: z.object({
    email: z.string().email("Email inválido"),
    password: z.string()
      .min(8, "Senha deve ter no mínimo 8 caracteres")
      .regex(/[A-Z]/, "Senha deve conter pelo menos uma letra maiúscula")
      .regex(/[0-9]/, "Senha deve conter pelo menos um número"),
    name: z.string().min(2).max(100),
    company: z.string().max(100).optional(),
  }),

  createConversation: z.object({
    name: z.string().min(1, "Nome do contato obrigatório"),
    phone: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    channel: z.string().optional(),
    initialMessage: z.string().optional(),
  }),

  updateConversation: z.object({
    status: z.string().optional(),
    aiEnabled: z.boolean().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    assignedUserId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    contactName: z.string().min(1).max(120).optional(),
  }),

  sendMessage: z.object({
    content: z.string().min(1, "Mensagem obrigatória").max(10000),
    messageType: z.enum(["text", "image", "audio", "video", "file", "document", "sticker"]).optional(),
    mediaUrl: z.string().optional(),
    mediaMimeType: z.string().optional(),
    mediaName: z.string().optional(),
    mediaSize: z.number().int().nonnegative().optional(),
    metadata: z.any().optional(),
  }),

  agentChat: z.object({
    message: z.string().min(1),
    conversationId: z.string().optional(),
    contactName: z.string().optional(),
  }),

  orchestrate: z.object({
    primaryAgentId: z.string().min(1),
    message: z.string().min(1),
    supportingAgentIds: z.array(z.string()).optional(),
  }),

  createConnection: z.object({
    provider: z.enum(["whatsmeow", "chatwoot", "whatsapp_cloud", "instagram", "web", "email"]),
    name: z.string().min(1).max(100),
    config: z.any().optional(),
  }),

  createKnowledgeBase: z.object({
    name: z.string().min(1).max(100),
  }),

  addDocument: z.object({
    name: z.string().min(1).max(200),
    type: z.enum(["pdf", "txt", "url", "csv"]),
    content: z.string().min(1),
  }),

  updateCalendarAvailability: z.object({
    availability: z.array(z.object({
      weekday: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      isActive: z.boolean().optional(),
    })).min(1),
  }),

  createAppointment: z.object({
    contactId: z.string().uuid().nullable().optional(),
    conversationId: z.string().min(1).nullable().optional(),
    aiAgentId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    startsAt: z.string().datetime(),
    durationMinutes: z.number().int().min(15).max(480).optional(),
  }),

  updateAppointment: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    status: z.enum(["scheduled", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  }),
};
