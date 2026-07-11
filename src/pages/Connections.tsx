import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  CheckCircle2,
  LogOut,
  Loader2,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  X,
  Cpu,
} from "lucide-react";
import { api } from "@/src/lib/api";
import { formatPhoneForDisplay } from "../lib/phone";
import { ENGINE_ONE_NAME, ENGINE_TWO_NAME } from "../components/BrandLogo";

type EngineTab = "whatsmeow" | "wahaplus";

export default function Connections() {
  const [engineTab, setEngineTab] = useState<EngineTab>("whatsmeow");
  const [connections, setConnections] = useState<any[]>([]);
  const [wahaplusSessions, setWahaplusSessions] = useState<any[]>([]);
  const [instanceName, setInstanceName] = useState("");
  const [wahaplusSessionName, setWahaplusSessionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState("");
  const [qrByInstance, setQrByInstance] = useState<Record<string, string>>({});
  const [statusByInstance, setStatusByInstance] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pairingQr, setPairingQr] = useState<string | null>(null);
  const [pairingError, setPairingError] = useState("");
  const [pairingSecondsLeft, setPairingSecondsLeft] = useState(50);
  const [pairingLastUpdatedAt, setPairingLastUpdatedAt] = useState<Date | null>(null);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [wahaplusStatus, setWahaplusStatus] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pairingDeadlineRef = useRef(0);
  const whatsmeowLimitReached = connections.length > 0;

  useEffect(() => {
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (engineTab === "wahaplus") loadWahaplusSessions();
  }, [engineTab]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getConnections();
      const whatsmeowConnections = data.connections.filter((item) => item.channel.provider === "whatsmeow");
      setConnections(whatsmeowConnections);
      setStatusByInstance((current) => ({
        ...current,
        ...Object.fromEntries(whatsmeowConnections.map((item: any) => [item.id, {
          connected: item.status === "connected" || !!item.connectedAt,
          jid: item.jid,
          phone: item.phone,
          pushName: item.pushName,
          businessName: item.businessName,
          avatarUrl: item.avatarUrl,
          lastStatusAt: item.lastStatusAt,
        }])),
      }));
      void Promise.allSettled(whatsmeowConnections.map((item: any) => checkStatus(item.id, true)));
      if (engineTab === "wahaplus") await loadWahaplusSessions();
    } catch (e: any) {
      setError(e.message || "Erro ao carregar conexoes");
    } finally {
      setLoading(false);
    }
  };

  const loadWahaplusSessions = async () => {
    try {
      const status = await api.getWahaplusStatus().catch(() => ({ connected: false }));
      setWahaplusStatus(status);
      if (status.connected) {
        const data = await api.getWahaplusSessions();
        setWahaplusSessions(data.sessions || []);
      } else {
        setWahaplusSessions([]);
      }
    } catch (e: any) {
      setWahaplusStatus({ connected: false, error: e.message || `${ENGINE_TWO_NAME} indisponivel` });
      setWahaplusSessions([]);
    }
  };

  const createInstance = async () => {
    if (whatsmeowLimitReached) {
      setError(`WooTech IA 1 permite uma conexao por vez nesta stack. Use a conexao existente ou crie novas sessoes na aba ${ENGINE_TWO_NAME}.`);
      return;
    }
    if (!instanceName.trim()) {
      setError("Informe um nome para a conexao");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const data = await api.createConnection({
        provider: "whatsmeow",
        name: instanceName.trim(),
        config: {},
      });
      setConnections((items) => [...items, data.connection]);
      setInstanceName("");
      setSaving(false);
      openQr(data.connection.id);
    } catch (e: any) {
      setError(e.message || "Erro ao criar conexao");
      setSaving(false);
    }
  };

  const createWahaplusSession = async () => {
    if (!wahaplusSessionName.trim()) {
      setError("Informe um nome para a conexao");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const sessionName = wahaplusSessionName.trim();
      const created = await api.createWahaplusSession(sessionName);
      setWahaplusSessionName("");
      await loadWahaplusSessions();
      await openWahaplusQr(created.name || created.id || sessionName);
    } catch (e: any) {
      setError(e.message || `Erro ao criar conexao ${ENGINE_TWO_NAME}`);
    } finally {
      setSaving(false);
    }
  };

  const deleteWahaplusSession = async (sid: string) => {
    try {
      await api.deleteWahaplusSession(sid);
      await loadWahaplusSessions();
    } catch (e: any) {
      setError(e.message || "Erro ao deletar conexao");
    }
  };

  const openWahaplusQr = async (sid: string) => {
    try {
      setPairingError("");
      const data = await api.getWahaplusSessionQr(sid);
      if (data.qr) {
        const image = String(data.qr).startsWith("data:image/")
          ? data.qr
          : await QRCode.toDataURL(data.qr, { margin: 2, width: 280 });
        setPairingQr(image);
        setPairingId(`wahaplus-${sid}`);
        setPairingSecondsLeft(50);
        pairingDeadlineRef.current = Date.now() + 50000;
      } else {
      setPairingError("QR nao disponivel para esta conexao");
      }
    } catch (e: any) {
      setPairingError(e.message || "Erro ao carregar QR");
    }
  };

  const checkStatus = async (id: string, silent = false) => {
    try {
      if (!silent) {
        setCheckingId(id);
        setError("");
      }
      const data = await api.getWhatsmeowInstanceStatus(id);
      setStatusByInstance((items) => ({ ...items, [id]: data }));
      if (data.connected) {
        setConnections((items) => items.map((item) => (
          item.id === id
            ? {
                ...item,
                status: "connected",
                jid: data.jid || item.jid,
                phone: data.phone || item.phone,
                pushName: data.pushName || item.pushName,
                businessName: data.businessName || item.businessName,
                avatarUrl: data.avatarUrl || item.avatarUrl,
                lastStatusAt: new Date().toISOString(),
              }
            : item
        )));
      }
      return data;
    } catch (e: any) {
      setStatusByInstance((items) => ({
        ...items,
        [id]: { connected: false, error: e.message || "Bridge indisponivel" },
      }));
      return null;
    } finally {
      if (!silent) setCheckingId("");
    }
  };

  const updatePairingQr = async (id: string, manual = false) => {
    if (manual) setRefreshingQr(true);
    try {
      setPairingError("");
      const data = await api.getWhatsmeowInstanceQr(id);
      if (data.bridgeAvailable === false) {
        setStatusByInstance((items) => ({ ...items, [id]: data }));
        setPairingError(data.error || "Bridge WhatsApp indisponivel. Inicie o whatsmeow-bridge para gerar o QR Code.");
        return false;
      }
      if (!data.qr) {
        setStatusByInstance((items) => ({ ...items, [id]: data }));
        if (data.connected) {
          setPairingId(null);
          setPairingQr(null);
          return true;
        }
        setPairingError(data.error || "QR ainda nao disponivel no bridge, tente novamente.");
        return false;
      }
      const image = await QRCode.toDataURL(data.qr, { margin: 2, width: 280 });
      setQrByInstance((items) => ({ ...items, [id]: image }));
      setStatusByInstance((items) => ({ ...items, [id]: data }));
      setPairingQr(image);
      setPairingLastUpdatedAt(new Date());
      return true;
    } catch (e: any) {
      const message = e.message === "fetch failed"
        ? "Bridge WhatsApp offline. Inicie o whatsmeow-bridge na porta 4000."
        : (e.message || "Erro ao carregar QR Code");
      setPairingError(message);
      return false;
    } finally {
      if (manual) setRefreshingQr(false);
    }
  };

  const openQr = async (id: string) => {
    try {
      setCheckingId(id);
      setError("");
      setPairingError("");
      const ok = await updatePairingQr(id);
      if (!ok) {
        setError("Nao foi possivel gerar um QR valido agora. Verifique a mensagem no modal.");
      }
      setPairingId(id);
      setPairingSecondsLeft(50);
      pairingDeadlineRef.current = Date.now() + 50000;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const remainingSeconds = Math.max(0, Math.ceil((pairingDeadlineRef.current - Date.now()) / 1000));
        setPairingSecondsLeft(remainingSeconds);
        if (remainingSeconds <= 0) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPairingError("Janela de atualizacao encerrada. Clique em Atualizar QR para gerar um novo codigo.");
          return;
        }
        const st = await api.getWhatsmeowInstanceQr(id).catch((err) => ({
          connected: false,
          bridgeAvailable: false,
          error: err.message || "Bridge indisponivel",
        }));
        if (st.bridgeAvailable === false) {
          setStatusByInstance((items) => ({ ...items, [id]: st }));
          setPairingError(st.error || "Bridge WhatsApp indisponivel");
          return;
        }
        if (st?.connected) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPairingId(null);
          setPairingQr(null);
        } else if (st?.qr) {
          const newImg = await QRCode.toDataURL(st.qr, { margin: 2, width: 280 });
          setQrByInstance((items) => ({ ...items, [id]: newImg }));
          setPairingQr(newImg);
          setPairingLastUpdatedAt(new Date());
        }
      }, 5000);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar QR Code");
    } finally {
      setCheckingId("");
    }
  };

  const closePairing = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPairingId(null);
    setPairingQr(null);
    setPairingError("");
    setPairingSecondsLeft(50);
  };

  const refreshCurrentQr = async () => {
    if (!pairingId) return;
    pairingDeadlineRef.current = Date.now() + 50000;
    setPairingSecondsLeft(50);
    await updatePairingQr(pairingId, true);
  };

  const disconnectInstance = async (id: string) => {
    try {
      setCheckingId(id);
      setError("");
      const data = await api.logoutWhatsmeowInstance(id);
      setStatusByInstance((items) => ({ ...items, [id]: { ...items[id], ...data, connected: false } }));
      setConnections((items) => items.map((item) => (
        item.id === id ? { ...item, status: "disconnected" } : item
      )));
      if (pairingId === id) closePairing();
    } catch (e: any) {
      setError(e.message || "Erro ao desconectar conexao");
    } finally {
      setCheckingId("");
    }
  };

  const deleteInstance = async (connection: any) => {
    const ok = confirm(`Remover definitivamente a conexao "${connection.name}" e as conversas vinculadas a ela? Esta acao nao pode ser desfeita.`);
    if (!ok) return;
    try {
      setCheckingId(connection.id);
      setError("");
      await api.deleteConnection(connection.id, true);
      setConnections((items) => items.filter((item) => item.id !== connection.id));
      setStatusByInstance((items) => {
        const next = { ...items };
        delete next[connection.id];
        return next;
      });
      setQrByInstance((items) => {
        const next = { ...items };
        delete next[connection.id];
        return next;
      });
      if (pairingId === connection.id) closePairing();
    } catch (e: any) {
      setError(e.message || "Erro ao remover conexao");
    } finally {
      setCheckingId("");
    }
  };

  const connectionView = (connection: any) => {
    const status = statusByInstance[connection.id] || {};
    const phone = status.phone || connection.phone || connection.config?.phone || "";
    const pushName = status.pushName || status.businessName || connection.pushName || connection.businessName || connection.config?.pushName || connection.config?.businessName || "";
    const avatarUrl = status.avatarUrl || connection.avatarUrl || connection.config?.avatarUrl || "";
    const jid = status.jid || connection.jid || connection.config?.jid || "";
    const hasLiveStatus = Object.prototype.hasOwnProperty.call(status, "connected");
    const connected = hasLiveStatus ? !!status.connected : connection.status === "connected";
    return {
      phone,
      pushName: pushName || connection.name,
      avatarUrl,
      jid,
      connected,
      displayPhone: phone ? formatPhoneForDisplay(phone) : (jid ? jid.split("@")[0] : "Numero nao identificado"),
      initials: (pushName || connection.name || "W").slice(0, 2).toUpperCase(),
      lastStatusAt: status.lastStatusAt || connection.lastStatusAt || connection.config?.lastStatusAt,
      error: status.error,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Woo Tech IA</p>
          <h1 className="text-3xl font-display font-bold text-text">Perfil WhatsApp</h1>
          <p className="text-sm text-muted mt-2 max-w-2xl">
            Crie conexoes de WhatsApp para mensagens, chamadas e automacoes usando os dois motores da marca.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-bold text-muted hover:text-primary transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {/* Engine tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        <button
          onClick={() => setEngineTab("whatsmeow")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            engineTab === "whatsmeow"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-text"
          }`}
        >
          <Smartphone className="w-4 h-4" /> {ENGINE_ONE_NAME}
        </button>
        <button
          onClick={() => setEngineTab("wahaplus")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            engineTab === "wahaplus"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-text"
          }`}
        >
          <Cpu className="w-4 h-4" /> {ENGINE_TWO_NAME}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      {engineTab === "whatsmeow" && (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
          <section className="bg-surface border border-border rounded-2xl p-5 h-fit space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-[#128C7E]" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Nova conexao</h2>
                <p className="text-xs text-muted">{ENGINE_ONE_NAME} via whatsmeow + WaCalls</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Nome da conexao</label>
              <input
                value={instanceName}
                onChange={(e) => setInstanceName(e.target.value)}
                placeholder="Ex: WhatsApp Comercial"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50"
              />
            </div>

            <button
              onClick={createInstance}
              disabled={saving || whatsmeowLimitReached}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar conexao
            </button>

            <div className="p-4 bg-bg rounded-xl border border-border">
              <p className="text-xs font-bold text-text mb-2">Pareamento</p>
              <p className="text-xs text-muted leading-relaxed">
                {whatsmeowLimitReached
                  ? `WooTech IA 1 usa um bridge single-session. Para varias conexoes simultaneas, use a aba ${ENGINE_TWO_NAME}.`
                  : "Depois de criar a conexao, o QR Code abre automaticamente. Escaneie com o WhatsApp e aguarde a conexao."}
              </p>
            </div>
          </section>

          <section className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Conexoes {ENGINE_ONE_NAME}</h2>
                <p className="text-xs text-muted mt-1">WhatsApp cadastrados via whatsmeow e chamadas via WaCalls.</p>
              </div>
              <span className="text-xs font-bold text-muted">{connections.length} total</span>
            </div>

            {loading ? (
              <div className="p-8 flex items-center gap-3 text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando conexoes...
              </div>
            ) : connections.length === 0 ? (
              <div className="p-10 text-center">
                <Smartphone className="w-12 h-12 text-muted/40 mx-auto mb-4" />
                <h3 className="font-bold text-text">Nenhuma conexao criada</h3>
                <p className="text-sm text-muted mt-2">Crie a primeira conexao para conectar um WhatsApp.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
                {connections.map((connection) => {
                  const view = connectionView(connection);
                  return (
                    <div key={connection.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm hover:border-primary/30 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {view.avatarUrl ? (
                            <img src={view.avatarUrl} alt={view.pushName} className="w-12 h-12 rounded-2xl object-cover border border-border" />
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 flex items-center justify-center text-[#128C7E] text-sm font-black">
                              {view.initials}
                            </div>
                          )}
                          <span className={`absolute -right-1 -bottom-1 w-4 h-4 rounded-full border-2 border-white ${view.connected ? "bg-green-500" : "bg-yellow-400"}`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-bold text-sm truncate">{view.pushName}</p>
                            {view.connected && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-muted truncate">{connection.name}</p>
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-text">
                            <Phone className="w-3.5 h-3.5 text-muted" />
                            <span className="truncate">{view.displayPhone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${view.connected ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                          {view.connected ? "conectada" : "desconectada"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => checkStatus(connection.id)}
                            disabled={checkingId === connection.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-bg border border-border text-muted hover:text-primary disabled:opacity-50"
                            title="Atualizar status"
                          >
                            {checkingId === connection.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => openQr(connection.id)}
                            disabled={checkingId === connection.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 disabled:opacity-50"
                            title="Abrir QR"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => disconnectInstance(connection.id)}
                            disabled={checkingId === connection.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 disabled:opacity-50"
                            title="Desconectar"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteInstance(connection)}
                            disabled={checkingId === connection.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 border border-red-100 text-red-700 hover:bg-red-100 disabled:opacity-50"
                            title="Remover conexao"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {view.error && (
                        <p className="mt-3 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] font-bold text-red-600">{view.error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {engineTab === "wahaplus" && (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
          <section className="bg-surface border border-border rounded-2xl p-5 h-fit space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Cpu className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Nova conexao {ENGINE_TWO_NAME}</h2>
                <p className="text-xs text-muted">WhatsApp via WAHA+</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Nome da conexao</label>
              <input
                value={wahaplusSessionName}
                onChange={(e) => setWahaplusSessionName(e.target.value)}
                placeholder="Ex: WhatsApp Comercial"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50"
              />
            </div>

            <button
              onClick={createWahaplusSession}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-purple-700 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Criar conexao
            </button>

            <div className="p-4 bg-bg rounded-xl border border-border">
              <p className="text-xs font-bold text-text mb-2">Status {ENGINE_TWO_NAME}: {wahaplusStatus?.connected ? "Conectado" : "Desconectado"}</p>
              <p className="text-xs text-muted leading-relaxed">
                {ENGINE_TWO_NAME} roda via Docker com WAHA+. Certifique-se de que o container esta rodando e a WAHAPLUS_URL esta configurada no .env.
              </p>
            </div>
          </section>

          <section className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Conexoes {ENGINE_TWO_NAME}</h2>
                <p className="text-xs text-muted mt-1">Sessoes WhatsApp gerenciadas pelo WAHA+.</p>
              </div>
              <span className="text-xs font-bold text-muted">{wahaplusSessions.length} total</span>
            </div>

            {!wahaplusStatus?.connected ? (
              <div className="p-10 text-center">
                <Cpu className="w-12 h-12 text-muted/40 mx-auto mb-4" />
                <h3 className="font-bold text-text">{ENGINE_TWO_NAME} nao conectado</h3>
                <p className="text-sm text-muted mt-2">Configure WAHAPLUS_URL no .env e inicie o container Docker.</p>
                <p className="text-xs text-muted mt-1">docker run -d -p 3000:3000 devlikeapro/waha</p>
              </div>
            ) : wahaplusSessions.length === 0 ? (
              <div className="p-10 text-center">
                <Cpu className="w-12 h-12 text-muted/40 mx-auto mb-4" />
                <h3 className="font-bold text-text">Nenhuma conexao</h3>
                <p className="text-sm text-muted mt-2">Crie a primeira conexao para conectar um WhatsApp via {ENGINE_TWO_NAME}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-5">
                {wahaplusSessions.map((session: any) => {
                  const paired = session.state === "WORKING";
                  const name = session.name || session.id;
                  return (
                    <div key={session.id || session.name} className="rounded-2xl border border-border bg-white p-4 shadow-sm hover:border-purple-500/30 transition-all">
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 text-sm font-black">
                            {(name || "W").slice(0, 2).toUpperCase()}
                          </div>
                          <span className={`absolute -right-1 -bottom-1 w-4 h-4 rounded-full border-2 border-white ${paired ? "bg-green-500" : "bg-yellow-400"}`} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="font-bold text-sm truncate">{name}</p>
                            {paired && <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-muted truncate">{session.config?.jid || session.id}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${paired ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                          {paired ? "pareada" : session.state || "pendente"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {!paired && (
                            <button
                              onClick={() => openWahaplusQr(session.name || session.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-600 hover:bg-purple-500/20"
                              title="Abrir QR"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteWahaplusSession(session.name || session.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 border border-red-100 text-red-600 hover:bg-red-100"
                            title="Remover"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {pairingQr && pairingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closePairing}>
          <div
            className="bg-surface rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-border text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePairing}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-bg text-muted"
            >
              <X className="w-5 h-5" />
            </button>
            <Smartphone className="w-10 h-10 text-[#128C7E] mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-1">Conectar WhatsApp</h3>
            <p className="text-sm text-muted mb-6">
              Abra o WhatsApp no celular, vá em <strong>Menu {'>'} Aparelhos conectados</strong> e escaneie o QR Code abaixo.
            </p>
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold uppercase">
                Atualiza por {pairingSecondsLeft}s
              </span>
              {pairingLastUpdatedAt && (
                <span className="px-2.5 py-1 rounded-lg bg-bg border border-border text-muted text-[10px] font-bold uppercase">
                  {pairingLastUpdatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>
            <div className="flex justify-center mb-6">
              <img
                src={pairingQr}
                alt="QR Code WhatsApp"
                className="w-56 h-56 rounded-xl border-2 border-border bg-white p-2"
              />
            </div>
            {pairingError && (
              <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs font-bold text-yellow-800">
                {pairingError}
              </div>
            )}
            <button
              onClick={refreshCurrentQr}
              disabled={refreshingQr}
              className="mb-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              {refreshingQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Atualizar QR
            </button>
            <div className="flex items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Aguardando conexão...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
