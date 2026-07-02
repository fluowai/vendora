import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { CallRecord, WaSession } from "../types/calls";

interface WaCallsState {
  sessions: WaSession[]
  activeCalls: CallRecord[]
  incomingCall: { sessionId: string; callId: string; peer: string } | null
  connected: boolean
  sessionQRs: Record<string, string>
}

export function useWaCalls() {
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<WaCallsState>({
    sessions: [],
    activeCalls: [],
    incomingCall: null,
    connected: false,
    sessionQRs: {},
  });

  useEffect(() => {
    const token = localStorage.getItem("vendaora_token");
    if (!token) return;

    const socket = io({ auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      setState((s) => ({ ...s, connected: true }));
    });

    socket.on("disconnect", () => {
      setState((s) => ({ ...s, connected: false }));
    });

    socket.on("wacalls:sessions", (sessions: WaSession[]) => {
      setState((s) => {
        const merged = sessions.map((sess) => ({
          ...sess,
          qr: sess.qr || s.sessionQRs[sess.id] || undefined,
        }));
        return { ...s, sessions: merged };
      });
    });

    socket.on("wacalls:qr", (data: { sessionId: string; qr: string }) => {
      setState((s) => ({
        ...s,
        sessionQRs: { ...s.sessionQRs, [data.sessionId]: data.qr },
        sessions: s.sessions.map((sess) =>
          sess.id === data.sessionId ? { ...sess, qr: data.qr, state: "qr" as const } : sess,
        ),
      }));
    });

    socket.on("wacalls:auth", (data: { sessionId: string; state: string; paired: boolean; qr?: string }) => {
      setState((s) => ({
        ...s,
        sessionQRs: data.qr ? { ...s.sessionQRs, [data.sessionId]: data.qr } : s.sessionQRs,
        sessions: s.sessions.map((sess) =>
          sess.id === data.sessionId
            ? { ...sess, state: data.state as WaSession["state"], paired: data.paired, qr: data.qr || sess.qr }
            : sess,
        ),
      }));
    });

    socket.on("wacalls:list", (calls: CallRecord[]) => {
      setState((s) => ({ ...s, activeCalls: calls.filter((c) => c.status !== "ended") }));
    });

    socket.on("wacalls:incoming", (data: { sessionId: string; callId: string; peer: string }) => {
      setState((s) => ({ ...s, incomingCall: data }));
    });

    socket.on("wacalls:incoming-claimed", () => {
      setState((s) => ({ ...s, incomingCall: null }));
    });

    socket.on("wacalls:status", (data: { sessionId: string; callId: string; status: string; peer?: string }) => {
      setState((s) => ({
        ...s,
        activeCalls: s.activeCalls.map((c) =>
          c.callId === data.callId ? { ...c, status: data.status as CallRecord["status"] } : c,
        ),
      }));
    });

    socket.on("wacalls:ended", (data: { callId: string }) => {
      setState((s) => ({
        ...s,
        activeCalls: s.activeCalls.filter((c) => c.callId !== data.callId),
        incomingCall: s.incomingCall?.callId === data.callId ? null : s.incomingCall,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const apiCall = useCallback(async (path: string, options?: RequestInit) => {
    const token = localStorage.getItem("vendaora_token");
    const res = await fetch(`/api/calls${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "request failed");
      throw new Error(err);
    }
    if (res.status === 204) return null;
    return res.json();
  }, []);

  const createSession = useCallback((name: string) =>
    apiCall("/sessions", { method: "POST", body: JSON.stringify({ name }) }),
  [apiCall]);

  const deleteSession = useCallback((sid: string) =>
    apiCall(`/sessions/${sid}`, { method: "DELETE" }),
  [apiCall]);

  const pairSession = useCallback((sid: string) =>
    apiCall(`/sessions/${sid}/pair`, { method: "POST" }),
  [apiCall]);

  const logoutSession = useCallback((sid: string) =>
    apiCall(`/sessions/${sid}/logout`, { method: "POST" }),
  [apiCall]);

  const startCall = useCallback((sid: string, phone: string) =>
    apiCall(`/sessions/${sid}/calls`, { method: "POST", body: JSON.stringify({ phone }) }),
  [apiCall]);

  const sendWebRTC = useCallback((sid: string, callId: string, sdpOffer: string) =>
    apiCall(`/sessions/${sid}/calls/${callId}/webrtc`, { method: "POST", body: JSON.stringify({ sdp_offer: sdpOffer }) }),
  [apiCall]);

  const acceptCall = useCallback((sid: string, callId: string) =>
    apiCall(`/sessions/${sid}/calls/${callId}/accept`, { method: "POST" }),
  [apiCall]);

  const rejectCall = useCallback((sid: string, callId: string) =>
    apiCall(`/sessions/${sid}/calls/${callId}/reject`, { method: "POST" }),
  [apiCall]);

  const endCall = useCallback((sid: string, callId: string) =>
    apiCall(`/sessions/${sid}/calls/${callId}`, { method: "DELETE" }),
  [apiCall]);

  const fetchHistory = useCallback((sid: string) =>
    apiCall(`/sessions/${sid}/history`),
  [apiCall]);

  return {
    ...state,
    createSession,
    deleteSession,
    pairSession,
    logoutSession,
    startCall,
    sendWebRTC,
    acceptCall,
    rejectCall,
    endCall,
    fetchHistory,
  };
}
