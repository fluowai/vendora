import rateLimit from "express-rate-limit";

const skipInTest = () => process.env.NODE_ENV === "test";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
});

export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Tente novamente em 1 minuto." },
});

export const agentChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas mensagens para o agente. Aguarde um momento." },
});

export const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições de webhook. Tente novamente em 1 minuto." },
});

// WhatsApp-specific rate limiters (stricter to avoid WhatsApp blocks)
export const whatsappSendLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas mensagens WhatsApp enviadas. Aguarde um momento." },
});

export const whatsappMediaLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas mídias WhatsApp enviadas. Aguarde um momento." },
});
