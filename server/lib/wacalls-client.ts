function getBaseUrl(): string {
  return (process.env.WACALLS_URL || "").replace(/\/$/, "");
}

export type CallDirection = "outbound" | "inbound";
export type CallStatus = "starting" | "ringing" | "connected" | "ended";
export type SessionState = "qr" | "open" | "connecting" | "logged_out";

export interface WaCallRecord {
  sessionId: string
  callId: string
  owner?: string
  direction: CallDirection
  peer: string
  startedAt: number
  status: CallStatus
  endedAt?: number
  endReason?: string
}

export interface WaSessionInfo {
  id: string
  name: string
  jid: string
  state: SessionState
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
  state: SessionState
  paired: boolean
}

export interface WaHistoryResponse {
  rows: WaCallRecord[]
}

export class WacallsClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "WacallsClientError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    throw new WacallsClientError(503, "WACALLS_URL not configured");
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new WacallsClientError(res.status, text);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const wacalls = {
  listSessions: () =>
    request<WaSessionListResponse>("GET", "/api/sessions"),

  createSession: (name: string) =>
    request<{ id: string }>("POST", "/api/sessions", { name }),

  deleteSession: (sid: string) =>
    request<void>("DELETE", `/api/sessions/${sid}`),

  logoutSession: (sid: string) =>
    request<void>("POST", `/api/sessions/${sid}/logout`),

  pairSession: (sid: string) =>
    request<void>("POST", `/api/sessions/${sid}/pair`),

  startCall: (sid: string, phone: string, record?: boolean) =>
    request<WaCallResponse>("POST", `/api/sessions/${sid}/calls`, { phone, record }),

  sendWebRTC: (sid: string, callId: string, sdpOffer: string) =>
    request<WaWebRTCResponse>("POST", `/api/sessions/${sid}/calls/${callId}/webrtc`, { sdp_offer: sdpOffer }),

  acceptCall: (sid: string, callId: string) =>
    request<{ call: { callId: string } }>("POST", `/api/sessions/${sid}/calls/${callId}/accept`),

  rejectCall: (sid: string, callId: string) =>
    request<{ status: string }>("POST", `/api/sessions/${sid}/calls/${callId}/reject`),

  endCall: (sid: string, callId: string) =>
    request<void>("DELETE", `/api/sessions/${sid}/calls/${callId}`),

  history: (sid: string) =>
    request<WaHistoryResponse>("GET", `/api/sessions/${sid}/history`),

  eventsUrl: () => {
    const base = getBaseUrl();
    return base ? `${base}/api/events` : null;
  },
};
