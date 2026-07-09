import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type { CallRecord, WaSession } from "../types/calls";
import { api } from "../lib/api";

interface WaCallsState {
  sessions: WaSession[]
  activeCalls: CallRecord[]
  incomingCall: { sessionId: string; callId: string; peer: string; callerPn?: string; pushName?: string | null; avatarUrl?: string | null } | null
  connected: boolean
  sessionQRs: Record<string, string>
}

function expireSession() {
  localStorage.removeItem("vendaora_token");
  localStorage.removeItem("vendaora_user");
  if (window.location.pathname !== "/auth") {
    window.location.href = "/auth";
  }
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

    const handleSessions = (engine: "wacalls" | "wahaplus") => (sessions: WaSession[]) => {
      setState((s) => {
        const tagged = sessions.map((sess) => ({
          ...sess,
          engine,
          qr: sess.qr || s.sessionQRs[sess.id] || undefined,
        }));
        const others = s.sessions.filter((x) => x.engine !== engine);
        return { ...s, sessions: [...others, ...tagged] };
      });
    };

    const handleQR = (data: { sessionId: string; qr: string }) => {
      setState((s) => ({
        ...s,
        sessionQRs: { ...s.sessionQRs, [data.sessionId]: data.qr },
        sessions: s.sessions.map((sess) =>
          sess.id === data.sessionId ? { ...sess, qr: data.qr, state: "qr" as const } : sess,
        ),
      }));
    };

    const handleAuth = (data: { sessionId: string; state: string; paired: boolean; qr?: string }) => {
      setState((s) => ({
        ...s,
        sessionQRs: data.qr ? { ...s.sessionQRs, [data.sessionId]: data.qr } : s.sessionQRs,
        sessions: s.sessions.map((sess) =>
          sess.id === data.sessionId
            ? { ...sess, state: data.state as WaSession["state"], paired: data.paired, qr: data.qr || sess.qr }
            : sess,
        ),
      }));
    };

    const handleCallList = (calls: CallRecord[]) => {
      setState((s) => ({ ...s, activeCalls: calls.filter((c) => c.status !== "ended") }));
    };

    const handleIncoming = (data: { sessionId: string; callId: string; peer: string; callerPn?: string; pushName?: string | null; avatarUrl?: string | null }) => {
      setState((s) => ({ ...s, incomingCall: data }));
    };

    const handleIncomingClaimed = () => {
      setState((s) => ({ ...s, incomingCall: null }));
    };

    const handleCallStatus = (data: { sessionId: string; callId: string; status: string; peer?: string; callerPn?: string; pushName?: string | null; avatarUrl?: string | null; owner?: string }) => {
      setState((s) => ({
        ...s,
        activeCalls: s.activeCalls.map((c) =>
          c.callId === data.callId
            ? {
                ...c,
                status: data.status as CallRecord["status"],
                peer: data.peer || c.peer,
                callerPn: data.callerPn || c.callerPn,
                pushName: data.pushName ?? c.pushName,
                avatarUrl: data.avatarUrl ?? c.avatarUrl,
                owner: data.owner || c.owner,
              }
            : c,
        ),
      }));
    };

    const handleCallEnded = (data: { callId: string }) => {
      setState((s) => ({
        ...s,
        activeCalls: s.activeCalls.filter((c) => c.callId !== data.callId),
        incomingCall: s.incomingCall?.callId === data.callId ? null : s.incomingCall,
      }));
    };

    socket.on("wacalls:sessions", handleSessions("wacalls"));
    socket.on("wahaplus:sessions", handleSessions("wahaplus"));

    socket.on("wacalls:qr", handleQR);
    socket.on("wahaplus:qr", handleQR);

    socket.on("wacalls:auth", handleAuth);
    socket.on("wahaplus:auth", handleAuth);

    socket.on("wacalls:list", handleCallList);
    socket.on("wahaplus:list", handleCallList);

    socket.on("wacalls:incoming", handleIncoming);
    socket.on("wahaplus:incoming", handleIncoming);

    socket.on("wacalls:incoming-claimed", handleIncomingClaimed);
    socket.on("wahaplus:incoming-claimed", handleIncomingClaimed);

    socket.on("wacalls:status", handleCallStatus);
    socket.on("wahaplus:status", handleCallStatus);

    socket.on("wacalls:ended", handleCallEnded);
    socket.on("wahaplus:ended", handleCallEnded);

    return () => {
      socket.disconnect();
    };
  }, []);

  const apiCall = useCallback(async (path: string, options?: RequestInit) => {
    const token = localStorage.getItem("vendaora_token");
    if (!token) {
      expireSession();
      throw new Error("Sessao expirada");
    }

    const res = await fetch(`/api/calls${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (res.status === 401) {
      expireSession();
      throw new Error("Sessao expirada");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "request failed");
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed.error || text;
      } catch {}
      throw new Error(message);
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
