import { useCallback, useEffect, useState } from "react";
import { Cpu, Loader2, Phone, Plus, Smartphone, Trash2 } from "lucide-react";
import { useWaCalls } from "../hooks/useWaCalls";
import { useWebRTCCall } from "../hooks/useWebRTCCall";
import { CallDialer } from "../components/calls/CallDialer";
import { ActiveCall } from "../components/calls/ActiveCall";
import { CallHistory } from "../components/calls/CallHistory";
import { QRDisplay } from "../components/calls/QRDisplay";
import { api } from "../lib/api";
import type { WaSession } from "../types/calls";
import { ENGINE_ONE_NAME, ENGINE_TWO_NAME } from "../components/BrandLogo";

type EngineTab = "wacalls" | "wahaplus";

export default function CallsPage() {
  const [engine, setEngine] = useState<EngineTab>("wacalls");
  const [wahaplusAvailable, setWahaplusAvailable] = useState(false);

  const hook = useWaCalls();
  const webrtc = useWebRTCCall();

  const [selectedSession, setSelectedSession] = useState<WaSession | null>(null);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [webrtcConnecting, setWebrtcConnecting] = useState(false);

  const sessions = hook.sessions.filter((s) => s.engine === engine || !s.engine);
  const selectedSessionMatches = selectedSession && (
    selectedSession.engine === engine || !selectedSession.engine
  );

  useEffect(() => {
    api.getCallsBridgeStatus()
      .then((status: any) => setWahaplusAvailable(Boolean(status?.gateways?.wahaplus?.configured)))
      .catch(() => setWahaplusAvailable(false));
  }, []);

  useEffect(() => {
    if (engine === "wahaplus" && !wahaplusAvailable) {
      setEngine("wacalls");
    }
  }, [engine, wahaplusAvailable]);

  useEffect(() => {
    if (!selectedSessionMatches) {
      setSelectedSession(sessions.length > 0 ? sessions[0] : null);
    }
  }, [sessions, engine, selectedSessionMatches]);

  useEffect(() => {
    if (selectedSession?.id && engine === "wacalls") {
      hook.fetchHistory(selectedSession.id).then((d: any) => {
        if (d?.rows) setHistory(d.rows);
      }).catch(() => {});
    }
    if (selectedSession?.id && engine === "wahaplus") {
      api.getWahaplusCallHistory(selectedSession.id).then((d: any) => {
        if (d?.rows) setHistory(d.rows);
        else if (Array.isArray(d)) setHistory(d);
      }).catch(() => {});
    }
  }, [hook.fetchHistory, selectedSession?.id, engine]);

  useEffect(() => {
    if (webrtc.status === "connected") {
      setWebrtcConnecting(false);
      setCallError(null);
    }
    if (webrtc.status === "error" || webrtc.status === "disconnected") {
      setWebrtcConnecting(false);
    }
  }, [webrtc.status]);

  const doWebRTC = useCallback(
    async (sid: string, callId: string) => {
      setWebrtcConnecting(true);
      await webrtc.start(sid, callId, async (cid: string, sdpOffer: string) => {
        if (engine === "wacalls") {
          return hook.sendWebRTC(sid, cid, sdpOffer);
        }
        const res = await api.sendWahaplusWebRTC(sid, cid, sdpOffer);
        return res;
      });
    },
    [hook.sendWebRTC, webrtc, engine],
  );

  const handleStartCall = async (phone: string) => {
    if (!selectedSession) return;
    setCalling(true);
    setCallError(null);
    try {
      let result: any;
      if (engine === "wacalls") {
        result = await hook.startCall(selectedSession.id, phone);
      } else {
        result = await api.startWahaplusCall(selectedSession.id, phone);
      }
      if (result?.call?.callId) {
        await doWebRTC(selectedSession.id, result.call.callId);
      } else {
        setCallError("Falha ao iniciar chamada: resposta invalida do bridge");
      }
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Erro ao iniciar chamada");
    } finally {
      setCalling(false);
    }
  };

  const handleEndCall = async (callId: string) => {
    if (!selectedSession) return;
    webrtc.stop();
    try {
      if (engine === "wacalls") {
        await hook.endCall(selectedSession.id, callId);
      } else {
        await api.endWahaplusCall(selectedSession.id, callId);
      }
    } catch {}
  };

  const handleCreateSession = async () => {
    setCreating(true);
    setCallError(null);
    try {
      if (engine === "wacalls") {
        await hook.createSession(`Calls ${sessions.length + 1}`);
      } else {
        if (!wahaplusAvailable) {
          setCallError(`${ENGINE_TWO_NAME} nao esta configurado neste ambiente. Use ${ENGINE_ONE_NAME}.`);
          return;
        }
        await api.createWahaplusSession(`Calls ${sessions.length + 1}`);
      }
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Erro ao criar sessao");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSession = async (sid: string) => {
    try {
      if (engine === "wacalls") {
        await hook.deleteSession(sid);
      } else {
        await api.deleteWahaplusSession(sid);
      }
      if (selectedSession?.id === sid) setSelectedSession(null);
    } catch {}
  };

  const handlePairSession = async (sid: string) => {
    setCallError(null);
    try {
      if (engine === "wacalls") {
        await hook.pairSession(sid);
      }
    } catch (err) {
      setCallError(err instanceof Error ? err.message : "Erro ao parear dispositivo");
    }
  };

  const selectedQR = selectedSession?.id ? hook.sessionQRs[selectedSession.id] : null;
  const showQR = selectedSession && (selectedSession.state === "qr" || (selectedSession.state === "connecting" && selectedQR));

  return (
    <div className="space-y-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6 text-primary" /> Disparos agendados
          </h1>
          <p className="text-muted text-sm mt-1">
            {hook.connected ? "Central de chamadas conectada" : "Central de chamadas desconectada"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 text-sm border border-border rounded-xl hover:bg-bg transition-all"
          >
            {showHistory ? "Ocultar Historico" : "Historico"}
          </button>
        </div>
      </div>

      {/* Engine tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setEngine("wacalls")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            engine === "wacalls"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-text"
          }`}
        >
          <Smartphone className="w-4 h-4" /> {ENGINE_ONE_NAME}
        </button>
        {wahaplusAvailable && (
          <button
            onClick={() => setEngine("wahaplus")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              engine === "wahaplus"
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-text"
            }`}
          >
          <Cpu className="w-4 h-4" /> {ENGINE_TWO_NAME}
        </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Conexoes de voz</h2>
            <button
              onClick={handleCreateSession}
              disabled={creating}
              className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
          {callError && !selectedSession?.paired && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {callError}
            </div>
          )}

          <div className="space-y-2">
            {sessions.length === 0 && (
              <div className="text-center py-8 text-muted text-sm border border-dashed border-border rounded-xl">
                Nenhuma conexao {engine === "wahaplus" ? ENGINE_TWO_NAME : ENGINE_ONE_NAME}. Crie uma para comecar.
              </div>
            )}
            {sessions.map((s) => {
              const isPaired = s.paired;
              const isQr = s.state === "qr";
              return (
                <div
                  key={`${s.engine || engine}-${s.id}`}
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
                        isPaired ? "bg-green-500" : isQr ? "bg-yellow-500" : "bg-muted"
                      }`} />
                      <span className="text-sm font-medium truncate">{s.name}</span>
                      {s.engine && (
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          s.engine === "wahaplus"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {s.engine === "wahaplus" ? "IA 2" : "IA 1"}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.id); }}
                      className="p-1 text-muted hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1 truncate">
                    {isPaired ? s.jid : isQr ? "Aguardando QR" : "Nao pareado"}
                  </p>
                  {!isPaired && s.state !== "qr" && engine === "wacalls" && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePairSession(s.id); }}
                      className="mt-2 text-xs text-primary font-medium hover:underline"
                    >
                      Parear dispositivo
                    </button>
                  )}
                </div>
              );
            })}
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
              <p className="text-muted font-medium">Selecione ou crie uma conexao pareada</p>
              <p className="text-muted text-sm mt-1">Voce precisa parear uma conexao Woo Tech IA para fazer chamadas</p>
            </div>
          ) : (
            <>
              <div className="bg-surface border border-border rounded-xl p-4">
                <h3 className="font-semibold mb-3">Nova ligacao</h3>
                <CallDialer onStartCall={handleStartCall} calling={calling || webrtcConnecting} />
                {callError && (
                  <p className="text-red-500 text-xs mt-2">{callError}</p>
                )}
                {webrtc.status === "error" && (
                  <p className="text-red-500 text-xs mt-2">Erro WebRTC: {webrtc.error}</p>
                )}
              </div>

              {hook.activeCalls.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold">Ligacoes ativas ({hook.activeCalls.length})</h3>
                  {hook.activeCalls.map((call) => (
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
                  <h3 className="font-semibold mb-3">Historico de ligacoes</h3>
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
