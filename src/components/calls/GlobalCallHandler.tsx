import { useCallback, useEffect, useState } from "react";
import { Loader2, Phone, PhoneOff } from "lucide-react";
import { IncomingCall } from "./IncomingCall";
import { useWaCalls } from "../../hooks/useWaCalls";
import { useWebRTCCall } from "../../hooks/useWebRTCCall";
import { normalizePhoneForCall, preferredCallPeer } from "../../lib/phone";
import type { WaSession } from "../../types/calls";

interface CurrentCall {
  sessionId: string
  callId: string
  peer: string
  callerPn?: string | null
  pushName?: string | null
  avatarUrl?: string | null
  direction: "inbound" | "outbound"
}

async function fetchSessionsFallback() {
  const token = localStorage.getItem("vendaora_token");
  const response = await fetch("/api/calls/sessions", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.sessions) ? data.sessions as WaSession[] : [];
}

export function GlobalCallHandler() {
  const { sessions, incomingCall, acceptCall, rejectCall, startCall, sendWebRTC, endCall } = useWaCalls();
  const webrtc = useWebRTCCall();
  const [currentCall, setCurrentCall] = useState<CurrentCall | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [outboundDialing, setOutboundDialing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCall) return;
    if (webrtc.status === "disconnected" || webrtc.status === "error") {
      setCurrentCall(null);
    }
  }, [currentCall, webrtc.status]);

  const handleAccept = useCallback(async () => {
    if (!incomingCall) return;
    setAccepting(true);
    setActionError(null);

    try {
      const result = await acceptCall(incomingCall.sessionId, incomingCall.callId);
      const callId = result?.call?.callId || incomingCall.callId;
      setCurrentCall({
        sessionId: incomingCall.sessionId,
        callId,
        peer: incomingCall.peer,
        callerPn: incomingCall.callerPn,
        pushName: incomingCall.pushName,
        avatarUrl: incomingCall.avatarUrl,
        direction: "inbound",
      });
      await webrtc.start(incomingCall.sessionId, callId, (cid, sdpOffer) =>
        sendWebRTC(incomingCall.sessionId, cid, sdpOffer),
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao atender chamada");
      setCurrentCall(null);
      webrtc.stop();
    } finally {
      setAccepting(false);
    }
  }, [acceptCall, incomingCall, sendWebRTC, webrtc]);

  const handleStartOutboundCall = useCallback(async (rawPhone: string) => {
    const phone = normalizePhoneForCall(rawPhone);
    let session = sessions.find((item) => item.paired && item.state === "open") || sessions.find((item) => item.paired);

    if (!phone) {
      setActionError("Telefone invalido para chamada");
      return;
    }
    if (!session) {
      const fetchedSessions = await fetchSessionsFallback();
      session = fetchedSessions.find((item) => item.paired && item.state === "open") || fetchedSessions.find((item) => item.paired);
    }
    if (!session) {
      setActionError("Nenhuma sessao WhatsApp pareada para realizar chamada");
      return;
    }

    setOutboundDialing(true);
    setActionError(null);

    try {
      const result = await startCall(session.id, phone);
      const callId = result?.call?.callId;
      if (!callId) throw new Error("Resposta invalida do bridge de chamadas");

      setCurrentCall({ sessionId: session.id, callId, peer: phone, direction: "outbound" });
      await webrtc.start(session.id, callId, (cid, sdpOffer) =>
        sendWebRTC(session.id, cid, sdpOffer),
      );
    } catch (err) {
      setCurrentCall(null);
      webrtc.stop();
      setActionError(err instanceof Error ? err.message : "Erro ao iniciar chamada");
    } finally {
      setOutboundDialing(false);
    }
  }, [sendWebRTC, sessions, startCall, webrtc]);

  useEffect(() => {
    if (!actionError || incomingCall || currentCall) return;
    const timer = window.setTimeout(() => setActionError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [actionError, currentCall, incomingCall]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ phone?: string }>).detail;
      if (detail?.phone) {
        handleStartOutboundCall(detail.phone);
      }
    };

    window.addEventListener("pabx:start-call", listener);
    return () => window.removeEventListener("pabx:start-call", listener);
  }, [handleStartOutboundCall]);

  const handleReject = useCallback(async () => {
    if (!incomingCall) return;
    setRejecting(true);
    setActionError(null);

    try {
      await rejectCall(incomingCall.sessionId, incomingCall.callId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao recusar chamada");
    } finally {
      setRejecting(false);
    }
  }, [incomingCall, rejectCall]);

  const handleEnd = useCallback(async () => {
    if (!currentCall) return;
    const ending = currentCall;
    setCurrentCall(null);
    webrtc.stop();

    try {
      await endCall(ending.sessionId, ending.callId);
    } catch {}
  }, [currentCall, endCall, webrtc]);

  return (
    <>
      {incomingCall && !currentCall && !outboundDialing && (
        <IncomingCall
          peer={incomingCall.peer}
          callerPn={incomingCall.callerPn}
          pushName={incomingCall.pushName}
          avatarUrl={incomingCall.avatarUrl}
          onAccept={handleAccept}
          onReject={handleReject}
          accepting={accepting}
          rejecting={rejecting}
          error={actionError}
        />
      )}

      {actionError && !incomingCall && !currentCall && (
        <div className="fixed right-4 bottom-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 shadow-2xl">
          {actionError}
        </div>
      )}

      {outboundDialing && !currentCall && (
        <div className="fixed right-4 bottom-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Iniciando chamada</p>
              <p className="text-xs text-muted">Preparando audio pelo PABX</p>
            </div>
          </div>
        </div>
      )}

      {currentCall && (
        <div className="fixed right-4 bottom-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-border bg-surface shadow-2xl">
          <div className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {webrtc.status === "connecting" ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <Phone className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{currentCall.pushName || preferredCallPeer(currentCall) || "Telefone nao resolvido"}</p>
                {currentCall.pushName && (
                  <p className="text-[11px] text-muted truncate">{preferredCallPeer(currentCall) || "Telefone nao resolvido"}</p>
                )}
                <p className="text-xs text-muted">
                  {webrtc.status === "connecting"
                    ? "Conectando audio..."
                    : currentCall.direction === "outbound"
                      ? "Chamada realizada pelo PABX"
                      : "Chamada em atendimento"}
                </p>
              </div>
            </div>
            <button
              onClick={handleEnd}
              className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shrink-0"
              aria-label="Encerrar chamada"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
          {webrtc.status === "error" && webrtc.error && (
            <div className="border-t border-border px-4 py-3 text-xs text-red-500">
              {webrtc.error}
            </div>
          )}
        </div>
      )}
    </>
  );
}
