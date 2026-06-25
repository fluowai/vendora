import prisma from "./prisma.ts";
import { emitToTenant } from "./socket.ts";

interface HandoffRequest {
  conversationId: string
  tenantId: string
  reason: string
  departmentId?: string | null
  suggestedAgentId?: string | null
}

export async function requestHandoff(params: HandoffRequest) {
  const { conversationId, tenantId, reason, departmentId, suggestedAgentId } = params;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      aiEnabled: false,
      status: "waiting",
      departmentId: departmentId || undefined,
      assignedUserId: suggestedAgentId || undefined,
    },
  });

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      assignedUser: { select: { id: true, name: true } },
      department: true,
    },
  });

  const handoffEvent = {
    conversationId,
    contactName: conversation?.contact?.name || "Contato",
    reason,
    departmentName: conversation?.department?.name || "Geral",
    assignedTo: conversation?.assignedUser?.name || null,
    channel: conversation?.channel,
    tenantId,
    timestamp: new Date().toISOString(),
  };

  emitToTenant(tenantId, "handoff:requested", handoffEvent);

  if (suggestedAgentId) {
    const { emitToUser } = await import("./socket.ts");
    emitToUser(suggestedAgentId, "handoff:assigned", handoffEvent);
  }

  return handoffEvent;
}

export async function assignConversation(conversationId: string, userId: string, tenantId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
  });
  if (!conversation) throw new Error("Conversa não encontrada");

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      assignedUserId: userId,
      status: "active",
      aiEnabled: false,
    },
  });

  const { emitToUser } = await import("./socket.ts");
  emitToUser(userId, "conversation:assigned", {
    conversationId,
    tenantId,
    assignedAt: new Date().toISOString(),
  });

  return { assigned: true, conversationId, userId };
}
