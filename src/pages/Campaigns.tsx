import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  Pause,
  PhoneCall,
  Play,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { ENGINE_ONE_NAME, ENGINE_TWO_NAME } from "@/src/components/BrandLogo";

type ContactRow = {
  name?: string
  phone: string
  email?: string
};

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    return `55${digits}`;
  }
  return digits;
}

function parseContacts(value: string): ContactRow[] {
  const seen = new Set<string>();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,|\t]/).map((part) => part.trim());
      const phoneIndex = parts.findIndex((part) => normalizePhone(part).length >= 10);
      const phone = phoneIndex >= 0 ? normalizePhone(parts[phoneIndex]) : "";
      if (!phone || seen.has(phone)) return null;
      seen.add(phone);
      const name = parts.find((part, index) => index !== phoneIndex && !part.includes("@")) || "";
      const email = parts.find((part) => part.includes("@")) || "";
      return { name, phone, email };
    })
    .filter(Boolean) as ContactRow[];
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("consultivo e humano");
  const [links, setLinks] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [rawContacts, setRawContacts] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const contacts = useMemo(() => parseContacts(rawContacts), [rawContacts]);
  const whatsAppConnections = useMemo(
    () => connections.filter((item) => ["whatsmeow", "wahaplus", "whatsapp_cloud"].includes(item.channel?.provider)),
    [connections],
  );

  async function loadData() {
    setError("");
    setLoading(true);
    try {
      const [campaignPayload, connectionPayload] = await Promise.all([
        api.getDialingCampaigns(),
        api.getConnections(),
      ]);
      setCampaigns(campaignPayload.campaigns || []);
      if ((campaignPayload as any).migrationRequired) {
        setNotice((campaignPayload as any).warning || "Banco preparando as tabelas de campanhas.");
      }
      const rows = connectionPayload.connections || [];
      setConnections(rows);
      const defaults = rows
        .filter((item) => ["connected", "active"].includes(item.status))
        .filter((item) => ["whatsmeow", "wahaplus", "whatsapp_cloud"].includes(item.channel?.provider))
        .map((item) => item.id);
      setSelectedSessions((current) => current.length ? current : defaults.slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar campanhas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleSession(id: string) {
    setSelectedSessions((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function createCampaign() {
    setError("");
    setNotice("");
    if (!objective.trim()) {
      setError("Informe o objetivo da campanha.");
      return;
    }
    if (contacts.length === 0) {
      setError("Cole uma lista com telefones validos.");
      return;
    }
    if (selectedSessions.length === 0) {
      setError("Selecione pelo menos uma conexao WhatsApp.");
      return;
    }

    setCreating(true);
    try {
      const payload = await api.createSmartWhatsAppCampaign({
        campaignName,
        objective,
        tone,
        contacts,
        sessionIds: selectedSessions,
        links: links.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        mediaUrls: mediaUrls.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        variantCount: 5,
        intervalSeconds: 90,
        dailyLimit: 250,
        rotationStrategy: "round_robin",
      });
      setNotice(payload.warning || `Campanha criada com ${payload.summary?.valid || contacts.length} contatos validos.`);
      setCampaignName("");
      setObjective("");
      setRawContacts("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar campanha.");
    } finally {
      setCreating(false);
    }
  }

  async function updateCampaign(id: string, action: "start" | "pause" | "cancel") {
    setError("");
    try {
      if (action === "start") await api.startDialingCampaign(id);
      if (action === "pause") await api.pauseDialingCampaign(id);
      if (action === "cancel") await api.cancelDialingCampaign(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar campanha.");
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Woo Tech IA</p>
          <h1 className="text-3xl font-display font-bold text-foreground">Disparos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Crie campanhas automaticas com rotacao entre {ENGINE_ONE_NAME} e {ENGINE_TWO_NAME}, variacoes por IA e lista validada.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-bold"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[440px_1fr]">
        <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Campanha inteligente</h2>
              <p className="text-xs text-muted">Cole telefone, nome e email separados por linha.</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
              placeholder="Nome da campanha"
            />
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-primary"
              placeholder="Objetivo comercial da campanha"
            />
            <input
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
              placeholder="Tom da mensagem"
            />
            <textarea
              value={rawContacts}
              onChange={(event) => setRawContacts(event.target.value)}
              className="min-h-36 w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs outline-none focus:border-primary"
              placeholder={"Paulo;559999999999\nMaria;558888888888;maria@email.com"}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <textarea
                value={links}
                onChange={(event) => setLinks(event.target.value)}
                className="min-h-20 rounded-lg border border-border bg-bg p-3 text-xs outline-none focus:border-primary"
                placeholder="Links, um por linha"
              />
              <textarea
                value={mediaUrls}
                onChange={(event) => setMediaUrls(event.target.value)}
                className="min-h-20 rounded-lg border border-border bg-bg p-3 text-xs outline-none focus:border-primary"
                placeholder="Midias, uma URL por linha"
              />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-bg p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-muted">Conexoes para rotacao</span>
              <span className="text-xs font-bold text-primary">{contacts.length} contatos</span>
            </div>
            <div className="grid gap-2">
              {whatsAppConnections.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted">
                  Nenhuma conexao WhatsApp encontrada.
                </div>
              ) : whatsAppConnections.map((connection) => (
                <button
                  key={connection.id}
                  type="button"
                  onClick={() => toggleSession(connection.id)}
                  className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                    selectedSessions.includes(connection.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-foreground",
                  )}
                >
                  <span className="font-bold">{connection.name}</span>
                  <span className="text-xs">{connection.channel?.provider}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={createCampaign}
            disabled={creating}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Criar disparo inteligente
          </button>
        </section>

        <section className="rounded-lg border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="font-display text-xl font-bold">Campanhas</h2>
              <p className="text-xs text-muted">Ative, pause e acompanhe disparos automaticos.</p>
            </div>
            <span className="text-xs font-bold text-muted">{campaigns.length} total</span>
          </div>

          {loading ? (
            <div className="flex min-h-80 items-center justify-center text-muted">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center p-6 text-center text-sm text-muted">
              Nenhuma campanha cadastrada ainda.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-foreground">{campaign.name}</h3>
                      <span className={cn(
                        "rounded-full px-2 py-1 text-[11px] font-bold uppercase",
                        campaign.status === "active" && "bg-emerald-50 text-emerald-700",
                        campaign.status === "paused" && "bg-amber-50 text-amber-700",
                        campaign.status === "cancelled" && "bg-red-50 text-red-700",
                        !["active", "paused", "cancelled"].includes(campaign.status) && "bg-bg text-muted",
                      )}>
                        {campaign.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{campaign.description || campaign.mode}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-muted">
                      <span>{campaign.totalContacts || campaign._count?.contacts || 0} contatos</span>
                      <span>{campaign.calledCount || 0} chamadas</span>
                      <span>{campaign.answeredCount || 0} atendidas</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ActionButton icon={Play} label="Iniciar" onClick={() => updateCampaign(campaign.id, "start")} />
                    <ActionButton icon={Pause} label="Pausar" onClick={() => updateCampaign(campaign.id, "pause")} />
                    <ActionButton icon={XCircle} label="Cancelar" danger onClick={() => updateCampaign(campaign.id, "cancel")} />
                    <div className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs font-bold text-muted">
                      <PhoneCall className="h-4 w-4" />
                      {campaign.mode || "dialer"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: typeof Play
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold",
        danger ? "border-red-100 bg-red-50 text-red-700" : "border-border bg-bg text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
