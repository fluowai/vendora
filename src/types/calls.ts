export type CallDirection = "outbound" | "inbound";
export type CallStatus = "starting" | "ringing" | "connected" | "ended";
export type SessionState = "qr" | "open" | "connecting" | "logged_out";

export interface CallRecord {
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

export interface WaSession {
  id: string
  name: string
  jid: string
  state: SessionState
  paired: boolean
  qr?: string
}
