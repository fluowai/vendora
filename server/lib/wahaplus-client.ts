function getBaseUrl(): string {
  return (process.env.WAHAPLUS_URL || "http://vendedoraai_wahaplus:3000").replace(/\/$/, "");
}

export type WaCallDirection = "outbound" | "inbound";
export type WaCallStatus = "starting" | "ringing" | "connected" | "ended";
export type WaSessionState = "qr" | "open" | "connecting" | "logged_out";

export interface WaCallRecord {
  sessionId: string
  callId: string
  owner?: string
  ownerName?: string
  direction: WaCallDirection
  peer: string
  callerPn?: string
  pushName?: string
  avatarUrl?: string
  startedAt: number
  status: WaCallStatus
  endedAt?: number
  endReason?: string
}

export interface WaSessionInfo {
  id: string
  name: string
  jid: string
  state: WaSessionState
  paired: boolean
}

export interface WaCallResponse {
  call: { callId: string }
}

export interface WaWebRTCResponse {
  sdp_answer: string
}

export interface WaSessionListResponse {
  sessions: WaSessionInfo[]
}

export interface WaQRResponse {
  qr?: string
  state: WaSessionState
  paired: boolean
}

export interface WaHistoryResponse {
  rows: WaCallRecord[]
}

export class WahaplusClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "WahaplusClientError";
  }
}

async function request<T>(method: string, path: string, body?: unknown, _clientId?: string): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new WahaplusClientError(503, "WAHAPLUS_URL not configured");
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.error === "string") {
        message = parsed.error;
      } else if (typeof parsed?.message === "string") {
        message = parsed.message;
      }
    } catch {}
    throw new WahaplusClientError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function mapWahaSession(session: any): WaSessionInfo {
  const config = session.config || {};
  return {
    id: session.name || session.id,
    name: session.name || session.id,
    jid: config.jid || "",
    state: session.state === "WORKING" ? "open" : session.state === "SCAN_QR_CODE" ? "qr" : session.state || "connecting",
    paired: session.state === "WORKING",
  };
}

function mapWahaSessions(raw: any): WaSessionInfo[] {
  if (Array.isArray(raw)) return raw.map(mapWahaSession);
  if (raw?.sessions) return raw.sessions.map(mapWahaSession);
  return [];
}

function mapWahaCall(raw: any, sessionId: string): WaCallRecord {
  return {
    sessionId,
    callId: raw.id || raw.callId || "",
    direction: raw.direction || "outbound",
    peer: raw.peer || raw.phone || "",
    callerPn: raw.callerPn,
    pushName: raw.pushName,
    avatarUrl: raw.avatarUrl,
    startedAt: raw.startedAt || raw.startTime || Date.now(),
    status: raw.status || "starting",
    endedAt: raw.endedAt,
    endReason: raw.endReason,
    owner: raw.owner,
  };
}

export const wahaplus = {
  listSessions: () =>
    request<any>("GET", "/api/sessions").then(mapWahaSessions),

  createSession: async (name: string) => {
    const result = await request<any>("POST", "/api/sessions", { name });
    return { id: result.name || result.id || name };
  },

  deleteSession: (sid: string) =>
    request<void>("DELETE", `/api/sessions/${sid}`),

  logoutSession: (sid: string) =>
    request<void>("DELETE", `/api/sessions/${sid}/logout`).catch(() =>
      request<void>("DELETE", `/api/sessions/${sid}`)
    ),

  pairSession: (sid: string) =>
    request<void>("POST", `/api/sessions/${sid}/pair`),

  getSessionQR: (sid: string) =>
    request<any>("GET", `/api/screenshot/${sid}`).then((data) => ({
      qr: data.qr || data.base64 || null,
      state: data.state || "qr",
      paired: false,
    })),

  startCall: (sid: string, phone: string, _record?: boolean, _clientId?: string) =>
    request<WaCallResponse>("POST", `/api/sessions/${sid}/calls`, { phone }),

  sendWebRTC: (sid: string, callId: string, sdpOffer: string, _clientId?: string) =>
    request<WaWebRTCResponse>("POST", `/api/sessions/${sid}/calls/${callId}/webrtc`, { sdp_offer: sdpOffer }),

  acceptCall: (sid: string, callId: string, _clientId?: string) =>
    request<{ call: { callId: string } }>("POST", `/api/sessions/${sid}/calls/${callId}/accept`),

  rejectCall: (sid: string, callId: string, _clientId?: string) =>
    request<{ status: string }>("POST", `/api/sessions/${sid}/calls/${callId}/reject`),

  endCall: (sid: string, callId: string, _clientId?: string) =>
    request<void>("DELETE", `/api/sessions/${sid}/calls/${callId}`),

  history: (sid: string) =>
    request<any>("GET", `/api/sessions/${sid}/history`).then((data) => {
      const rows = Array.isArray(data) ? data : data?.rows || [];
      return { rows: rows.map((r: any) => mapWahaCall(r, sid)) };
    }),

  activeCalls: (sid: string) =>
    request<any>("GET", `/api/sessions/${sid}/calls`).then((data) => {
      const calls = Array.isArray(data) ? data : data?.calls || [];
      return calls.map((c: any) => mapWahaCall(c, sid));
    }),

  sendText: (session: string, to: string, text: string) =>
    request<any>("POST", "/api/sendText", { session, chatId: to, text }),

  sendMedia: (session: string, to: string, fileUrl: string, caption?: string) =>
    request<any>("POST", "/api/sendFile", { session, chatId: to, file: fileUrl, caption }),

  eventsUrl: () => {
    const base = getBaseUrl();
    return base ? `${base}/api/events` : null;
  },

  health: () =>
    request<any>("GET", "/api/health"),
};
