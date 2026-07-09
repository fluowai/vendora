import prisma from "./prisma.ts";
import { getIO } from "./socket.ts";
import { logger } from "./logger.ts";
import { preferredCallPeer, normalizePhoneForCall } from "./phone.ts";
import { addMessageJob } from "./queue.ts";

let bridge: WahaplusSSEBridge | null = null;

export function getWahaplusBridge(): WahaplusSSEBridge {
  if (!bridge) {
    bridge = new WahaplusSSEBridge();
  }
  return bridge;
}

interface ActiveCallInfo {
  sessionId: string
  callId: string
  direction: string
  peer: string
  callerPn?: string
  pushName?: string
  avatarUrl?: string
  startedAt: number
  owner?: string
}

export class WahaplusSSEBridge {
  private controller: AbortController | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private activeCalls = new Map<string, ActiveCallInfo>();

  get isConnected() {
    return this.connected;
  }

  start() {
    if (this.controller) return;
    this.connect();
  }

  stop() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    this.connected = false;
    this.activeCalls.clear();
  }

  private async connect() {
    const baseUrl = process.env.WAHAPLUS_URL?.replace(/\/$/, "");
    if (!baseUrl) {
      this.scheduleReconnect(10000);
      return;
    }

    this.controller = new AbortController();

    try {
      const response = await fetch(`${baseUrl}/api/events`, {
        signal: this.controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (!response.ok || !response.body) {
        this.scheduleReconnect(5000);
        return;
      }

      this.connected = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              this.broadcast(data);
            } catch {}
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
    }

    this.connected = false;
    this.activeCalls.clear();
    this.scheduleReconnect(5000);
  }

  private async persistCallRecord(data: any) {
    try {
      const info = this.activeCalls.get(data.id);
      if (!info) return;

      const startedAt = new Date(info.startedAt);
      const endedAt = data.endedAt ? new Date(data.endedAt) : new Date();
      const peer = preferredCallPeer(info);

      await prisma.waCallRecord.upsert({
        where: { callId: data.id },
        update: { status: "ended", endedAt, endReason: data.reason || null },
        create: {
          sessionId: info.sessionId,
          callId: data.id,
          owner: info.owner || null,
          direction: info.direction,
          peer,
          status: "ended",
          startedAt,
          endedAt,
          endReason: data.reason || null,
        },
      });

      await this.handleMissedInboundCall(info, data.reason || "");
      this.activeCalls.delete(data.id);
    } catch (err) {
      logger.error("[Wahaplus] Failed to persist call record", { error: err });
    }
  }

  private async findContactByPhone(phone: string) {
    const normalized = normalizePhoneForCall(phone);
    if (!normalized) return null;
    const tail = normalized.slice(-8);
    return prisma.contact.findFirst({
      where: {
        OR: [
          { phone: normalized },
          { phone: { contains: normalized } },
          ...(tail ? [{ phone: { contains: tail } }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async enrichCallIdentity(data: any) {
    const peer = preferredCallPeer({ peer: data.peer, callerPn: data.callerPn });
    const contact = await this.findContactByPhone(peer);

    return {
      peer,
      callerPn: normalizePhoneForCall(data.callerPn),
      pushName: data.pushName || contact?.name || null,
      avatarUrl: data.avatarUrl || null,
    };
  }

  private async getOrCreateMissedCallConversation(info: ActiveCallInfo) {
    const phone = preferredCallPeer(info);
    if (!phone) return null;

    let contact = await this.findContactByPhone(phone);
    let tenantId = contact?.tenantId;

    if (!tenantId) {
      const tenant = await prisma.tenant.findFirst({ select: { id: true } });
      tenantId = tenant?.id;
    }
    if (!tenantId) return null;

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          name: info.pushName || phone,
          phone,
          source: "wahaplus",
        },
      });
    }

    const channel = await prisma.channel.upsert({
      where: { id: `${tenantId}-wahaplus` },
      update: { status: "active" },
      create: {
        id: `${tenantId}-wahaplus`,
        tenantId,
        name: "WAHAPlus",
        provider: "wahaplus",
        status: "active",
      },
    });

    const channelInstance = await prisma.channelInstance.findFirst({
      where: { channelId: channel.id, status: "active" },
    }) || await prisma.channelInstance.create({
      data: { channelId: channel.id, name: "WAHAPlus principal", status: "active" },
    });

    const existing = await prisma.conversation.findFirst({
      where: { tenantId, contactId: contact.id, channel: "wahaplus", status: { not: "closed" } },
      orderBy: { updatedAt: "desc" },
    });
    if (existing) return existing;

    return prisma.conversation.create({
      data: {
        tenantId,
        contactId: contact.id,
        channelInstanceId: channelInstance.id,
        channel: "wahaplus",
        status: "active",
        aiEnabled: true,
        priority: "high",
      },
    });
  }

  private async handleMissedInboundCall(info: ActiveCallInfo, reason: string) {
    if (info.direction !== "inbound" || info.owner) return;
    const missedReasons = new Set(["timeout", "no_answer", "busy", ""]);
    if (!missedReasons.has(reason)) return;

    const conversation = await this.getOrCreateMissedCallConversation(info);
    if (!conversation) return;

    const now = new Date();
    const phone = preferredCallPeer(info);
    const aiAgent = await prisma.aiAgent.findFirst({
      where: { tenantId: conversation.tenantId, enabled: true, status: "active" },
      orderBy: { updatedAt: "desc" },
    });
    const content = aiAgent
      ? `Oi, aqui e o ${aiAgent.name}. Vi que sua chamada nao foi atendida agora. Pode me dizer como posso ajudar?`
      : "Oi, vimos que sua chamada nao foi atendida agora. Pode enviar sua mensagem por aqui que ja vamos continuar o atendimento.";

    const message = await prisma.message.create({
      data: {
        tenantId: conversation.tenantId,
        conversationId: conversation.id,
        contactId: conversation.contactId,
        senderType: aiAgent ? "ai" : "system",
        senderId: aiAgent?.id || "wahaplus-missed-call",
        channel: conversation.channel,
        messageType: "text",
        content,
        metadata: { source: "wahaplus_missed_call", callId: info.callId, phone, reason, aiAgentId: aiAgent?.id || null },
        sentAt: now,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now, aiEnabled: true, priority: "high" },
    });

    getIO().to(`tenant:${conversation.tenantId}`).emit("conversation:updated", {
      id: conversation.id,
      lastMessage: message.content,
      lastMessageAt: message.sentAt,
      time: message.sentAt,
      aiEnabled: true,
      priority: "high",
    });
  }

  private async persistIncomingMessage(data: any) {
    try {
      const payload = data.payload || data;
      const sessionName = data.session || payload.session || "default";
      const from = payload.from || "";
      const text = typeof payload.text === "string" ? payload.text : payload.text?.body || payload.body || "";
      const messageId = payload.id || "";
      const messageType = payload.type || "chat";

      if (!from || !text) return;

      const phone = from.replace(/@.+$/, "").replace(/\D/g, "");
      const pushName = payload.pushName || payload.sender?.pushName || "";

      const tenant = await prisma.tenant.findFirst();
      if (!tenant) return;

      let contact = phone ? await this.findContactByPhone(phone) : null;
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            tenantId: tenant.id,
            name: pushName || phone || "Contato WAHA+",
            phone: phone || null,
            pushName: pushName || null,
            source: "wahaplus",
          },
        });
      }

      const channel = await prisma.channel.upsert({
        where: { id: `${tenant.id}-wahaplus` },
        update: { status: "active" },
        create: {
          id: `${tenant.id}-wahaplus`,
          tenantId: tenant.id,
          name: "WAHAPlus",
          provider: "wahaplus",
          status: "active",
        },
      });

      const channelInstance = await prisma.channelInstance.findFirst({
        where: { channelId: channel.id, status: "active" },
      }) || await prisma.channelInstance.create({
        data: { channelId: channel.id, name: sessionName || "WAHAPlus principal", status: "active" },
      });

      const conversationId = `${tenant.id}-wahaplus-${phone || from}`;
      const now = new Date();
      const conversation = await prisma.conversation.upsert({
        where: { id: conversationId },
        update: { lastMessageAt: now },
        create: {
          id: conversationId,
          tenantId: tenant.id,
          contactId: contact.id,
          channelInstanceId: channelInstance.id,
          channel: "wahaplus",
          status: "active",
          aiEnabled: true,
          lastMessageAt: now,
        },
      });

      if (messageId) {
        const existing = await prisma.message.findFirst({
          where: { tenantId: tenant.id, conversationId: conversation.id, providerMessageId: messageId },
        });
        if (existing) return;
      }

      const message = await prisma.message.create({
        data: {
          tenantId: tenant.id,
          conversationId: conversation.id,
          contactId: contact.id,
          senderType: "contact",
          senderId: contact.id,
          channel: "wahaplus",
          providerMessageId: messageId || null,
          messageType: messageType === "chat" ? "text" : messageType || "text",
          content: text,
          sentAt: now,
        },
      });

      getIO().to(`tenant:${tenant.id}`).emit("conversation:updated", {
        id: conversation.id,
        lastMessage: message.content,
        lastMessageAt: message.sentAt,
        time: message.sentAt,
        aiEnabled: true,
      });

      addMessageJob({
        type: "incoming",
        tenantId: tenant.id,
        conversationId: conversation.id,
        messageId: message.id,
      }).catch((error) => logger.error("[Wahaplus] Failed to queue incoming message", { error }));
    } catch (err) {
      logger.error("[Wahaplus] Failed to persist incoming message", { error: err });
    }
  }

  private async broadcast(data: any) {
    try {
      const io = getIO();
      const eventType = data.type;

      switch (eventType) {
        case "session-list":
          io.emit("wahaplus:sessions", data.sessions);
          break;
        case "session-qr":
          io.emit("wahaplus:qr", { sessionId: data.sessionId, qr: data.qr });
          break;
        case "auth-state":
          io.emit("wahaplus:auth", { sessionId: data.sessionId, state: data.state, paired: data.paired, qr: data.qr });
          break;
        case "incoming": {
          const identity = await this.enrichCallIdentity(data);
          io.emit("wahaplus:incoming", { sessionId: data.sessionId, callId: data.id, ...identity, offeredAt: data.offeredAt });
          break;
        }
        case "incoming-claimed":
          io.emit("wahaplus:incoming-claimed", { sessionId: data.sessionId, callId: data.id, owner: data.owner });
          break;
        case "call-status": {
          const identity = await this.enrichCallIdentity(data);
          this.activeCalls.set(data.id, {
            sessionId: data.sessionId,
            callId: data.id,
            direction: data.direction || "outbound",
            peer: identity.peer || data.peer || "",
            callerPn: identity.callerPn || data.callerPn,
            pushName: identity.pushName || data.pushName,
            avatarUrl: identity.avatarUrl || data.avatarUrl,
            startedAt: data.startedAt || Date.now(),
            owner: data.owner,
          });
          io.emit("wahaplus:status", { sessionId: data.sessionId, callId: data.id, status: data.status, ...identity, owner: data.owner });
          break;
        }
        case "call-ended":
          io.emit("wahaplus:ended", { sessionId: data.sessionId, callId: data.id, reason: data.reason, owner: data.owner });
          this.persistCallRecord(data);
          break;
        case "call-list":
          io.emit("wahaplus:list", data.calls);
          break;
        case "message":
          this.persistIncomingMessage(data);
          io.emit("wahaplus:message", data);
          break;
      }
    } catch {}
  }

  private scheduleReconnect(ms: number) {
    if (this.controller?.signal.aborted) return;
    this.reconnectTimeout = setTimeout(() => this.connect(), ms);
  }
}
