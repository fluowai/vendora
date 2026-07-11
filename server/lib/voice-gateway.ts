import {
  wacalls,
  type WaCallResponse,
  type WaHistoryResponse,
  type WaSessionListResponse,
  type WaWebRTCResponse,
} from "./wacalls-client.ts";
import {
  wahaplus,
} from "./wahaplus-client.ts";

export type VoiceGatewayKind = "wacalls" | "wahaplus" | "telnyx" | "twilio" | "asterisk";

export interface VoiceGatewayCapabilities {
  whatsappCalls: boolean
  pstnCalls: boolean
  sipTrunking: boolean
  mediaStreaming: boolean
  recording: boolean
  contactValidation: boolean
}

export interface StartVoiceCallInput {
  sessionId: string
  phone: string
  record?: boolean
  clientId?: string
}

export interface WebRTCOfferInput {
  sessionId: string
  callId: string
  sdpOffer: string
  clientId?: string
}

export interface VoiceGateway {
  kind: VoiceGatewayKind
  capabilities: VoiceGatewayCapabilities
  listSessions(): Promise<WaSessionListResponse>
  createSession(name: string): Promise<{ id: string }>
  deleteSession(sessionId: string): Promise<void>
  logoutSession(sessionId: string): Promise<void>
  pairSession(sessionId: string): Promise<void>
  startCall(input: StartVoiceCallInput): Promise<WaCallResponse>
  sendWebRTC(input: WebRTCOfferInput): Promise<WaWebRTCResponse>
  acceptCall(sessionId: string, callId: string, clientId?: string): Promise<{ call: { callId: string } }>
  rejectCall(sessionId: string, callId: string, clientId?: string): Promise<{ status: string }>
  endCall(sessionId: string, callId: string, clientId?: string): Promise<void>
  history(sessionId: string): Promise<WaHistoryResponse>
}

const wacallsGateway: VoiceGateway = {
  kind: "wacalls",
  capabilities: {
    whatsappCalls: true,
    pstnCalls: false,
    sipTrunking: false,
    mediaStreaming: true,
    recording: true,
    contactValidation: true,
  },
  listSessions: () => wacalls.listSessions(),
  createSession: (name) => wacalls.createSession(name),
  deleteSession: (sessionId) => wacalls.deleteSession(sessionId),
  logoutSession: (sessionId) => wacalls.logoutSession(sessionId),
  pairSession: (sessionId) => wacalls.pairSession(sessionId),
  startCall: ({ sessionId, phone, record, clientId }) =>
    wacalls.startCall(sessionId, phone, record, clientId),
  sendWebRTC: ({ sessionId, callId, sdpOffer, clientId }) =>
    wacalls.sendWebRTC(sessionId, callId, sdpOffer, clientId),
  acceptCall: (sessionId, callId, clientId) => wacalls.acceptCall(sessionId, callId, clientId),
  rejectCall: (sessionId, callId, clientId) => wacalls.rejectCall(sessionId, callId, clientId),
  endCall: (sessionId, callId, clientId) => wacalls.endCall(sessionId, callId, clientId),
  history: (sessionId) => wacalls.history(sessionId),
};

const wahaplusGateway: VoiceGateway = {
  kind: "wahaplus",
  capabilities: {
    whatsappCalls: true,
    pstnCalls: false,
    sipTrunking: false,
    mediaStreaming: true,
    recording: true,
    contactValidation: true,
  },
  listSessions: () => wahaplus.listSessions().then((sessions) => ({ sessions })),
  createSession: (name) => wahaplus.createSession(name),
  deleteSession: (sessionId) => wahaplus.deleteSession(sessionId),
  logoutSession: (sessionId) => wahaplus.logoutSession(sessionId),
  pairSession: (sessionId) => wahaplus.pairSession(sessionId),
  startCall: ({ sessionId, phone, record, clientId }) =>
    wahaplus.startCall(sessionId, phone, record, clientId),
  sendWebRTC: ({ sessionId, callId, sdpOffer, clientId }) =>
    wahaplus.sendWebRTC(sessionId, callId, sdpOffer, clientId),
  acceptCall: (sessionId, callId, clientId) => wahaplus.acceptCall(sessionId, callId, clientId),
  rejectCall: (sessionId, callId, clientId) => wahaplus.rejectCall(sessionId, callId, clientId),
  endCall: (sessionId, callId, clientId) => wahaplus.endCall(sessionId, callId, clientId),
  history: (sessionId) => wahaplus.history(sessionId),
};

async function requestAsterisk<T>(method: string, path: string, body?: unknown): Promise<T> {
  const baseUrl = (process.env.ASTERISK_GATEWAY_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("ASTERISK_GATEWAY_URL nao configurado");
  }
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ASTERISK_GATEWAY_TOKEN ? { Authorization: `Bearer ${process.env.ASTERISK_GATEWAY_TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(text || `Asterisk gateway error ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const asteriskGateway: VoiceGateway = {
  kind: "asterisk",
  capabilities: {
    whatsappCalls: false,
    pstnCalls: true,
    sipTrunking: true,
    mediaStreaming: true,
    recording: true,
    contactValidation: false,
  },
  listSessions: async () => ({
    sessions: [{
      id: process.env.ASTERISK_DEFAULT_ENDPOINT || "asterisk-main",
      name: "WooTech IA SIP",
      jid: "sip",
      state: "open",
      paired: true,
    }],
  }),
  createSession: async (name) => requestAsterisk<{ id: string }>("POST", "/api/sessions", { name }),
  deleteSession: async (sessionId) => requestAsterisk<void>("DELETE", `/api/sessions/${sessionId}`),
  logoutSession: async () => undefined,
  pairSession: async () => undefined,
  startCall: ({ sessionId, phone, record, clientId }) =>
    requestAsterisk<WaCallResponse>("POST", "/api/calls", {
      endpoint: sessionId,
      phone,
      record,
      clientId,
    }),
  sendWebRTC: ({ sessionId, callId, sdpOffer, clientId }) =>
    requestAsterisk<WaWebRTCResponse>("POST", `/api/calls/${callId}/webrtc`, { sessionId, sdp_offer: sdpOffer, clientId }),
  acceptCall: (sessionId, callId, clientId) =>
    requestAsterisk<{ call: { callId: string } }>("POST", `/api/calls/${callId}/accept`, { sessionId, clientId }),
  rejectCall: (sessionId, callId, clientId) =>
    requestAsterisk<{ status: string }>("POST", `/api/calls/${callId}/reject`, { sessionId, clientId }),
  endCall: (sessionId, callId, clientId) =>
    requestAsterisk<void>("DELETE", `/api/calls/${callId}`, { sessionId, clientId }),
  history: (sessionId) =>
    requestAsterisk<WaHistoryResponse>("GET", `/api/sessions/${sessionId}/history`),
};

export function getVoiceGateway(kind: VoiceGatewayKind = "wacalls"): VoiceGateway {
  switch (kind) {
    case "wacalls":
      return wacallsGateway;
    case "wahaplus":
      return wahaplusGateway;
    case "asterisk":
      return asteriskGateway;
    default:
      throw new Error(`Voice gateway ${kind} ainda nao implementado`);
  }
}

export function getDefaultVoiceGateway(): VoiceGateway {
  const kind = (process.env.VOICE_GATEWAY || "wacalls").toLowerCase() as VoiceGatewayKind;
  return getVoiceGateway(kind);
}
