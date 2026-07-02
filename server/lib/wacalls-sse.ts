import prisma from "./prisma.ts";
import { getIO } from "./socket.ts";
import { logger } from "./logger.ts";

let bridge: WaCallsSSEBridge | null = null;

export function getWaCallsBridge(): WaCallsSSEBridge {
  if (!bridge) {
    bridge = new WaCallsSSEBridge();
  }
  return bridge;
}

interface ActiveCallInfo {
  sessionId: string
  callId: string
  direction: string
  peer: string
  startedAt: number
  owner?: string
}

export class WaCallsSSEBridge {
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
    const baseUrl = process.env.WACALLS_URL?.replace(/\/$/, "");
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

      await prisma.waCallRecord.upsert({
        where: { callId: data.id },
        update: { status: "ended", endedAt, endReason: data.reason || null },
        create: {
          sessionId: info.sessionId,
          callId: data.id,
          owner: info.owner || null,
          direction: info.direction,
          peer: info.peer,
          status: "ended",
          startedAt,
          endedAt,
          endReason: data.reason || null,
        },
      });

      this.activeCalls.delete(data.id);
    } catch (err) {
      logger.error("[WaCalls] Failed to persist call record", { error: err });
    }
  }

  private broadcast(data: any) {
    try {
      const io = getIO();
      const eventType = data.type;

      switch (eventType) {
        case "session-list":
          io.emit("wacalls:sessions", data.sessions);
          break;
        case "session-qr":
          io.emit("wacalls:qr", { sessionId: data.sessionId, qr: data.qr });
          break;
        case "auth-state":
          io.emit("wacalls:auth", { sessionId: data.sessionId, state: data.state, paired: data.paired, qr: data.qr });
          break;
        case "incoming":
          io.emit("wacalls:incoming", { sessionId: data.sessionId, callId: data.id, peer: data.peer, offeredAt: data.offeredAt });
          break;
        case "incoming-claimed":
          io.emit("wacalls:incoming-claimed", { sessionId: data.sessionId, callId: data.id, owner: data.owner });
          break;
        case "call-status": {
          this.activeCalls.set(data.id, {
            sessionId: data.sessionId,
            callId: data.id,
            direction: data.direction || "outbound",
            peer: data.peer || "",
            startedAt: data.startedAt || Date.now(),
            owner: data.owner,
          });
          io.emit("wacalls:status", { sessionId: data.sessionId, callId: data.id, status: data.status, peer: data.peer, owner: data.owner });
          break;
        }
        case "call-ended":
          io.emit("wacalls:ended", { sessionId: data.sessionId, callId: data.id, reason: data.reason, owner: data.owner });
          this.persistCallRecord(data);
          break;
        case "call-list":
          io.emit("wacalls:list", data.calls);
          break;
      }
    } catch {}
  }

  private scheduleReconnect(ms: number) {
    if (this.controller?.signal.aborted) return;
    this.reconnectTimeout = setTimeout(() => this.connect(), ms);
  }
}
