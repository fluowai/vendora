function normalizeBaseUrl(value?: string): string {
  return (value || "").replace(/\/$/, "").trim();
}

export function getWacallsCandidateUrls(): string[] {
  return Array.from(new Set([
    normalizeBaseUrl(process.env.WACALLS_URL),
    "http://vendedoraai_wacalls:8081",
    "http://wacalls:8081",
    "http://localhost:8081",
  ].filter(Boolean)));
}

export type CallDirection = "outbound" | "inbound";
export type CallStatus = "starting" | "ringing" | "connected" | "ended";
export type SessionState = "qr" | "open" | "connecting" | "logged_out";

export interface WaCallRecord {
  sessionId: string
  callId: string
  owner?: string
  ownerName?: string
  direction: CallDirection
  peer: string
  callerPn?: string
  pushName?: string
  avatarUrl?: string
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

export interface WaContactValidationResult {
  input: string
  phone: string
  whatsappPhone?: string
  jid?: string
  lid?: string
  isOnWhatsApp: boolean
  pushName?: string
  businessName?: string
  avatarUrl?: string
  photoStatus?: string
  error?: string
}

export interface WaContactValidationResponse {
  results: WaContactValidationResult[]
}

export class WacallsClientError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "WacallsClientError";
  }
}

async function request<T>(method: string, path: string, body?: unknown, clientId?: string): Promise<T> {
  const candidateUrls = getWacallsCandidateUrls();
  if (candidateUrls.length === 0) {
    throw new WacallsClientError(503, "WACALLS_URL not configured and no Docker alias available");
  }

  let lastError: unknown = null;
  for (const baseUrl of candidateUrls) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(clientId ? { "X-Client-Id": clientId } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(7000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "unknown error");
        let message = text;
        try {
          const parsed = JSON.parse(text);
          if (typeof parsed?.error === "string") {
            message = parsed.error;
          }
        } catch {}
        throw new WacallsClientError(res.status, message);
      }

      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    } catch (error) {
      if (error instanceof WacallsClientError && error.status < 500) {
        throw error;
      }
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError || "unknown error");
  throw new WacallsClientError(503, `WaCalls indisponivel nos aliases da stack (${candidateUrls.join(", ")}): ${detail}`);
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

  startCall: (sid: string, phone: string, record?: boolean, clientId?: string) =>
    request<WaCallResponse>("POST", `/api/sessions/${sid}/calls`, { phone, record }, clientId),

  sendWebRTC: (sid: string, callId: string, sdpOffer: string, clientId?: string) =>
    request<WaWebRTCResponse>("POST", `/api/sessions/${sid}/calls/${callId}/webrtc`, { sdp_offer: sdpOffer }, clientId),

  acceptCall: (sid: string, callId: string, clientId?: string) =>
    request<{ call: { callId: string } }>("POST", `/api/sessions/${sid}/calls/${callId}/accept`, undefined, clientId),

  rejectCall: (sid: string, callId: string, clientId?: string) =>
    request<{ status: string }>("POST", `/api/sessions/${sid}/calls/${callId}/reject`, undefined, clientId),

  endCall: (sid: string, callId: string, clientId?: string) =>
    request<void>("DELETE", `/api/sessions/${sid}/calls/${callId}`, undefined, clientId),

  history: (sid: string) =>
    request<WaHistoryResponse>("GET", `/api/sessions/${sid}/history`),

  validateContacts: (sid: string, phones: string[], enrich = true, clientId?: string) =>
    request<WaContactValidationResponse>("POST", `/api/sessions/${sid}/contacts/validate`, { phones, enrich }, clientId),

  eventsUrl: () => {
    const base = getWacallsCandidateUrls()[0] || "";
    return base ? `${base}/api/events` : null;
  },
};
