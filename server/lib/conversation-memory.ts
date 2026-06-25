import prisma from "./prisma.ts";
import { executeLLM } from "./providers.ts";

const SUMMARY_INTERVAL = 10;

export async function summarizeConversation(conversationId: string): Promise<string | null> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { sentAt: "asc" },
          take: 50,
        },
      },
    });

    if (!conversation || conversation.messages.length === 0) return null;

    const alreadySummarized = conversation.messages.filter((m) => m.messageType === "summary").length;
    if (conversation.messages.filter((m) => m.messageType === "text").length < SUMMARY_INTERVAL && alreadySummarized > 0) {
      return null;
    }

    const transcript = conversation.messages
      .filter((m) => m.messageType !== "summary")
      .map((m) => {
        const sender = m.senderType === "contact" ? "Cliente" : m.senderType === "user" ? "Atendente" : "IA";
        return `${sender}: ${m.content}`;
      })
      .join("\n");

    if (!transcript) return null;

    const result = await executeLLM(
      { provider: "gemini", model: "gemini-3-flash-preview", temperature: 0.3, maxTokens: 512 },
      `Resuma a seguinte conversa de atendimento em português. Seja objetivo e inclua:
- Assunto principal
- O que já foi resolvido
- O que ainda está pendente
- Próximos passos

Mantenha o resumo em 3-5 frases.

${transcript}`,
    );

    const summary = result.text.trim();

    await prisma.message.create({
      data: {
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        senderType: "system",
        senderId: "system",
        channel: conversation.channel,
        messageType: "summary",
        content: `📋 Resumo automático:\n${summary}`,
        sentAt: new Date(),
      },
    });

    return summary;
  } catch (error) {
    console.error("Summarization error:", error);
    return null;
  }
}
