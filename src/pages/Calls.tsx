import { useState, useEffect, useCallback } from "react";
import { Phone, Plus, Loader2, Trash2, RefreshCw } from "lucide-react";
import { useWaCalls } from "../hooks/useWaCalls";
import { useWebRTCCall } from "../hooks/useWebRTCCall";
import { CallDialer } from "../components/calls/CallDialer";
import { ActiveCall } from "../components/calls/ActiveCall";
import { IncomingCall } from "../components/calls/IncomingCall";
import { CallHistory } from "../components/calls/CallHistory";
import { QRDisplay } from "../components/calls/QRDisplay";
import type { WaSession } from "../types/calls";

export default function CallsPage() {
  const {
    sessions,
    activeCalls,
    incomingCall,
    connected,
    sessionQRs,
    createSession,
    deleteSession,
    pairSession,
    startCall,
    sendWebRTC,
    acceptCall,
    rejectCall,
    endCall,
    fetchHistory,
  } = useWaCalls();

  const webrtc = useWebRTCCall();

  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [calling, setCalling] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [webrtcConnecting, setWebrtcConnecting] = useState(false);

  useEffect(() => {
    if (sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0]);
    }
  }, [sessions, selectedSession]);

  useEffect(() => {
    if (selectedSession?.id) {
      fetchHistory(selectedSession.id).then((d: any) => {
        if (d?.rows) setHistory(d.rows);
      }).catch(() => {});
    }
  }, [selectedSession?.id]);

  useEffect(() => {
    if (webrtc.status === "connected") {
      setWebrtcConnecting(false);
    }
    if (webrtc.status === "error" || webrtc.status === "disconnected") {
      setWebrtcConnecting(false);
    }
  }, [webrtc.status]);

  const doWebRTC = useCallback(
    async (sid: string, callId: string) => {
      setWebrtcConnecting(true);
      await webrtc.start(sid, callId, (cid: string, sdpOffer: string) =>
        sendWebRTC(sid, cid, sdpOffer),
      );
    },
    [webrtc, sendWebRTC],
  );

  const handleStartCall = async (phone: string) => {
    if (!selectedSession) return;
    setCalling(true);
    try {
      const result = await startCall(selectedSession.id, phone);
      if (result?.call?.callId) {
        await doWebRTC(selectedSession.id, result.call.callId);
      }
    } finally {
      setCalling(false);
    }
  };

  const handleAcceptCall = async () => {
    if (!selectedSession || !incomingCall) return;
    try {
      const result = await acceptCall(selectedSession.id, incomingCall.callId);
      if (result?.call?.callId) {
        await doWebRTC(selectedSession.id, result.call.callId);
      }
    } catch {}
  };

  const handleRejectCall = async () => {
    if (!selectedSession || !incomingCall) return;
    try {
      await rejectCall(selectedSession.id, incomingCall.callId);
    } catch {}
  };

  const handleEndCall = async (callId: string) => {
    if (!selectedSession) return;
    webrtc.stop();
    try {
      await endCall(selectedSession.id, callId);
    } catch {}
  };

  const handleCreateSession = async () => {
    setCreating(true);
    try {
      await createSession(`Calls ${sessions.length + 1}`);
    } finally {
      setCreating(false);
    }
  };

  const selectedQR = selectedSession?.id ? sessionQRs[selectedSession.id] : null;
  const showQR = selectedSession && (selectedSession.state === "qr" || (selectedSession.state === "connecting" && selectedQR));

  return (
    <div className="space-y-6 h-full">
      {incomingCall && selectedSession && (
        <IncomingCall
          peer={incomingCall.peer}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary" /> Chamadas
          </h1>
          <p className="text-muted text-sm mt-1">
            {connected ? "Conectado ao WaCalls" : "Desconectado do WaCalls"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-bg transition-all"
          >
            {showHistory ? "Ocultar Histórico" : "Histórico"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sessões WhatsApp</h2>
            <button
              onClick={handleCreateSession}
              disabled={creating}
              className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>

          <div className="space-y-2">
            {sessions.length === 0 && (
              <div className="text-center py-8 text-muted text-sm border border-dashed border-border rounded-xl">
                Nenhuma sessão. Crie uma para começar.
              </div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedSession?.id === s.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full ${
                      s.paired ? "bg-green-500" : s.state === "qr" ? "bg-yellow-500" : "bg-muted"
                    }`} />
                    <span className="text-sm font-medium truncate">{s.name}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="p-1 text-muted hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted mt-1 truncate">
                  {s.paired ? s.jid : s.state === "qr" ? "Aguardando QR" : "Não pareado"}
                </p>
                {!s.paired && s.state !== "qr" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); pairSession(s.id); }}
                    className="mt-2 text-xs text-primary font-medium hover:underline"
                  >
                    Parear dispositivo
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {showQR ? (
            <div className="bg-surface border border-border rounded-2xl">
              <QRDisplay qr={selectedQR!} sessionName={selectedSession!.name} />
            </div>
          ) : !selectedSession?.paired ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl">
              <Phone className="w-12 h-12 text-muted mb-4" />
              <p className="text-muted font-medium">Selecione ou crie uma sessão pareada</p>
              <p className="text-muted text-sm mt-1">Você precisa parear um dispositivo WhatsApp para fazer chamadas</p>
            </div>
          ) : (
            <>
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="font-semibold mb-3">Nova Chamada</h3>
                <CallDialer onStartCall={handleStartCall} calling={calling || webrtcConnecting} />
                {webrtc.status === "error" && (
                  <p className="text-red-500 text-xs mt-2">Erro WebRTC: {webrtc.error}</p>
                )}
              </div>

              {activeCalls.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Chamadas Ativas ({activeCalls.length})</h3>
                  {activeCalls.map((call) => (
                    <ActiveCall
                      key={call.callId}
                      call={{
                        ...call,
                        status: webrtc.status === "connected" && call.status === "ringing"
                          ? "connected"
                          : call.status,
                      }}
                      onEndCall={() => handleEndCall(call.callId)}
                    />
                  ))}
                </div>
              )}

              {showHistory && (
                <div className="bg-surface border border-border rounded-xl p-4">
                  <h3 className="font-semibold mb-3">Histórico de Chamadas</h3>
                  <CallHistory records={history} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
