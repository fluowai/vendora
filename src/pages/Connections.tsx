import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  CheckCircle2,
  LogOut,
  Loader2,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import { api } from "@/src/lib/api";

export default function Connections() {
  const [connections, setConnections] = useState<any[]>([]);
  const [instanceName, setInstanceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState("");
  const [qrByInstance, setQrByInstance] = useState<Record<string, string>>({});
  const [statusByInstance, setStatusByInstance] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [pairingId, setPairingId] = useState<string | null>(null);
  const [pairingQr, setPairingQr] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    load();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getConnections();
      setConnections(data.connections.filter((item) => item.channel.provider === "whatsmeow"));
    } catch (e: any) {
      setError(e.message || "Erro ao carregar instancias");
    } finally {
      setLoading(false);
    }
  };

  const createInstance = async () => {
    if (!instanceName.trim()) {
      setError("Informe um nome para a instancia");
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
      setError(e.message || "Erro ao criar instancia");
      setSaving(false);
    }
  };

  const checkStatus = async (id: string) => {
    try {
      setCheckingId(id);
      setError("");
      const data = await api.getWhatsmeowInstanceStatus(id);
      setStatusByInstance((items) => ({ ...items, [id]: data }));
      return data;
    } catch (e: any) {
      setStatusByInstance((items) => ({
        ...items,
        [id]: { connected: false, error: e.message || "Bridge indisponivel" },
      }));
      return null;
    } finally {
      setCheckingId("");
    }
  };

  const openQr = async (id: string) => {
    try {
      setCheckingId(id);
      setError("");
      const data = await api.getWhatsmeowInstanceQr(id);
      if (!data.qr) {
        setStatusByInstance((items) => ({ ...items, [id]: data }));
        if (!data.connected) {
          setError("QR ainda nao disponivel no bridge, tente novamente");
        }
        return;
      }
      const image = await QRCode.toDataURL(data.qr, { margin: 2, width: 280 });
      setQrByInstance((items) => ({ ...items, [id]: image }));
      setStatusByInstance((items) => ({ ...items, [id]: data }));
      setPairingId(id);
      setPairingQr(image);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const st = await api.getWhatsmeowInstanceQr(id);
        if (st?.connected) {
          if (pollRef.current) clearInterval(pollRef.current);
          setPairingId(null);
          setPairingQr(null);
        } else if (st?.qr && st.qr !== qrByInstance[id]) {
          const newImg = await QRCode.toDataURL(st.qr, { margin: 2, width: 280 });
          setQrByInstance((items) => ({ ...items, [id]: newImg }));
          setPairingQr(newImg);
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
      setError(e.message || "Erro ao desconectar instancia");
    } finally {
      setCheckingId("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">WhatsApp</p>
          <h1 className="text-3xl font-display font-bold text-text">Conexões</h1>
          <p className="text-sm text-muted mt-2 max-w-2xl">
            Crie instancias de WhatsApp para receber e enviar mensagens no painel.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border rounded-xl text-sm font-bold text-muted hover:text-primary transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm font-bold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <section className="bg-surface border border-border rounded-2xl p-5 h-fit space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-[#128C7E]" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Nova instância</h2>
              <p className="text-xs text-muted">WhatsApp via whatsmeow</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Nome da instância</label>
            <input
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder="Ex: WhatsApp Comercial"
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50"
            />
          </div>

          <button
            onClick={createInstance}
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white rounded-xl px-4 py-3 text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar instância
          </button>

          <div className="p-4 bg-bg rounded-xl border border-border">
            <p className="text-xs font-bold text-text mb-2">Pareamento</p>
            <p className="text-xs text-muted leading-relaxed">
              Depois de criar a instância, o QR Code abre automaticamente. Escaneie com o WhatsApp e aguarde a conexão.
            </p>
          </div>
        </section>

        <section className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg">Instâncias</h2>
              <p className="text-xs text-muted mt-1">Números WhatsApp cadastrados para atendimento.</p>
            </div>
            <span className="text-xs font-bold text-muted">{connections.length} total</span>
          </div>

          {loading ? (
            <div className="p-8 flex items-center gap-3 text-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando instâncias...
            </div>
          ) : connections.length === 0 ? (
            <div className="p-10 text-center">
              <Smartphone className="w-12 h-12 text-muted/40 mx-auto mb-4" />
              <h3 className="font-bold text-text">Nenhuma instância criada</h3>
              <p className="text-sm text-muted mt-2">Crie a primeira instância para conectar um WhatsApp.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {connections.map((connection) => (
                <div key={connection.id} className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-[#128C7E]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{connection.name}</p>
                      <p className="text-xs text-muted truncate">WhatsApp whatsmeow</p>
                    </div>
                  </div>
                  <div className="flex flex-col md:items-end gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${statusByInstance[connection.id]?.connected ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                        {statusByInstance[connection.id]?.connected ? <CheckCircle2 className="w-3 h-3" /> : <Loader2 className="w-3 h-3 animate-spin" />}
                        {statusByInstance[connection.id]?.connected ? "conectada" : "desconectada"}
                      </span>
                      <button
                        onClick={() => checkStatus(connection.id)}
                        disabled={checkingId === connection.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg border border-border text-muted text-[10px] font-bold uppercase hover:text-primary"
                      >
                        {checkingId === connection.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Status
                      </button>
                      <button
                        onClick={() => openQr(connection.id)}
                        disabled={checkingId === connection.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase hover:bg-primary/20"
                      >
                        <QrCode className="w-3 h-3" /> QR
                      </button>
                      <button
                        onClick={() => disconnectInstance(connection.id)}
                        disabled={checkingId === connection.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 text-red-600 text-[10px] font-bold uppercase hover:bg-red-100 disabled:opacity-50"
                      >
                        {checkingId === connection.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                        Desconectar
                      </button>
                    </div>
                    {statusByInstance[connection.id]?.error && (
                      <p className="text-[10px] text-red-500 font-bold max-w-xs">{statusByInstance[connection.id].error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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
            <div className="flex justify-center mb-6">
              <img
                src={pairingQr}
                alt="QR Code WhatsApp"
                className="w-56 h-56 rounded-xl border-2 border-border bg-white p-2"
              />
            </div>
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
