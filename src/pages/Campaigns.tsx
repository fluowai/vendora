import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  MessageSquareText,
  Pause,
  PhoneCall,
  Play,
  RefreshCw,
  RotateCw,
  Send,
  SlidersHorizontal,
  Upload,
  XCircle,
} from "lucide-react";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { ENGINE_ONE_NAME, ENGINE_TWO_NAME } from "@/src/components/BrandLogo";

type ContactRow = {
  name?: string
  phone: string
  email?: string
  metadata?: Record<string, unknown>
};

type SmartCampaignResult = {
  warning?: string | null
  summary?: { valid: number; invalid: number; total: number; uniquePhones: number; errors: number }
  blueprint?: {
    variants?: { title: string; body: string }[]
    rotation?: { instances?: { id: string; name: string; provider: string; status: string }[] }
  }
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

function rowsToContacts(rows: unknown[][]): ContactRow[] {
  const nonEmpty = rows.filter((row) => row.some((cell) => String(cell || "").trim()));
  if (!nonEmpty.length) return [];

  const first = nonEmpty[0].map((cell) => String(cell || "").trim().toLowerCase());
  const hasHeader = first.some((cell) => ["telefone", "phone", "celular", "whatsapp", "nome", "name", "email"].includes(cell));
  const headers = hasHeader ? first : [];
  const dataRows = hasHeader ? nonEmpty.slice(1) : nonEmpty;
  const findColumn = (names: string[]) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const phoneIndex = hasHeader ? findColumn(["telefone", "phone", "celular", "whatsapp", "numero"]) : -1;
  const nameIndex = hasHeader ? findColumn(["nome", "name", "cliente", "contato"]) : -1;
  const emailIndex = hasHeader ? findColumn(["email", "e-mail"]) : -1;
  const seen = new Set<string>();

  return dataRows.map((row) => {
    const phoneCell = phoneIndex >= 0 ? row[phoneIndex] : row.find((cell) => normalizePhone(String(cell || "")).length >= 10);
    const phone = normalizePhone(String(phoneCell || ""));
    if (!phone || seen.has(phone)) return null;
    seen.add(phone);

    return {
      phone,
      name: nameIndex >= 0 ? String(row[nameIndex] || "").trim() : "",
      email: emailIndex >= 0 ? String(row[emailIndex] || "").trim() : "",
      metadata: { raw: row.map((cell) => String(cell || "").trim()) },
    };
  }).filter(Boolean) as ContactRow[];
}

async function parseCampaignFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt" || ext === "csv") {
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((line) => line.split(/[;\t,]/).map((cell) => cell.trim()));
    return rowsToContacts(rows);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
  return rowsToContacts(rows);
}

function contactsToText(rows: ContactRow[]) {
  return rows.map((row) => [row.name, row.phone, row.email].filter(Boolean).join(";")).join("\n");
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [funnels, setFunnels] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [objective, setObjective] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [tone, setTone] = useState("consultivo e humano");
  const [links, setLinks] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");
  const [rawContacts, setRawContacts] = useState("");
  const [fileName, setFileName] = useState("");
  const [variantCount, setVariantCount] = useState(5);
  const [intervalSeconds, setIntervalSeconds] = useState(90);
  const [dailyLimit, setDailyLimit] = useState(250);
  const [rotationStrategy, setRotationStrategy] = useState("round_robin");
  const [result, setResult] = useState<SmartCampaignResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [parsing, setParsing] = useState(false);
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
      api.getFunnels()
        .then((payload) => {
          setFunnels(payload.funnels || []);
          if (!funnelId && payload.funnels?.[0]?.id) setFunnelId(payload.funnels[0].id);
        })
        .catch(() => setFunnels([]));
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

  async function handleFile(file?: File) {
    if (!file) return;
    setError("");
    setNotice("");
    setResult(null);
    setParsing(true);
    try {
      const parsed = await parseCampaignFile(file);
      if (!parsed.length) {
        setError("Nao encontrei telefones validos no arquivo.");
        return;
      }
      setRawContacts(contactsToText(parsed));
      setFileName(file.name);
      if (!campaignName) setCampaignName(file.name.replace(/\.[^.]+$/, ""));
      setNotice(`${parsed.length} contatos carregados da lista.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler arquivo.");
    } finally {
      setParsing(false);
    }
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
        funnelId,
        tone,
        contacts,
        sessionIds: selectedSessions,
        links: links.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        mediaUrls: mediaUrls.split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
        variantCount,
        intervalSeconds,
        dailyLimit,
        rotationStrategy,
      });
      setResult(payload);
      setNotice(payload.warning || `Campanha criada com ${payload.summary?.valid || contacts.length} contatos validos.`);
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
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">Campanha inteligente</h2>
              <p className="text-xs text-muted">Suba lista ou cole telefone, nome e email.</p>
            </div>
          </div>

          <label className="mb-3 flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg p-4 text-center transition hover:border-primary">
            {parsing ? <Loader2 className="h-7 w-7 animate-spin text-primary" /> : <Upload className="h-7 w-7 text-primary" />}
            <div>
              <p className="text-sm font-bold">{fileName || "Selecionar lista"}</p>
              <p className="text-xs text-muted">xlsx, xls, csv ou txt</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>

          <div className="space-y-3">
            <input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
              placeholder="Nome da campanha"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={funnelId}
                onChange={(event) => setFunnelId(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
              >
                <option value="">Sem funil</option>
                {funnels.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
                ))}
              </select>
              <select
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
              >
                <option value="consultivo e humano">Consultivo</option>
                <option value="direto e comercial">Direto</option>
                <option value="premium e discreto">Premium</option>
                <option value="leve e conversacional">Conversacional</option>
              </select>
            </div>
            <textarea
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              className="min-h-24 w-full rounded-lg border border-border bg-bg p-3 text-sm outline-none focus:border-primary"
              placeholder="Objetivo comercial da campanha"
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberInput label="Variacoes" value={variantCount} min={3} max={12} onChange={setVariantCount} />
              <NumberInput label="Intervalo" value={intervalSeconds} min={15} max={3600} onChange={setIntervalSeconds} />
              <NumberInput label="Limite dia" value={dailyLimit} min={1} max={5000} onChange={setDailyLimit} />
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-bg p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
                <RotateCw className="h-3.5 w-3.5" /> Rotacao
              </span>
              <span className="text-xs font-bold text-primary">{contacts.length} contatos</span>
            </div>
            <select
              value={rotationStrategy}
              onChange={(event) => setRotationStrategy(event.target.value)}
              className="mb-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
            >
              <option value="round_robin">Rodizio entre instancias</option>
              <option value="balanced">Balanceado por volume</option>
              <option value="warmup">Aquecimento gradual</option>
            </select>
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
          {result?.blueprint?.variants?.length ? (
            <div className="border-b border-border p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquareText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Mensagens Groq</h2>
                  <p className="text-xs text-muted">
                    {result.summary?.valid || 0} contatos validos, {result.summary?.invalid || 0} removidos
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {result.blueprint.variants.map((variant, index) => (
                  <div key={`${variant.title}-${index}`} className="rounded-lg border border-border bg-bg p-3">
                    <p className="mb-1 text-[11px] font-bold uppercase text-muted">{variant.title || `Variacao ${index + 1}`}</p>
                    <p className="text-sm leading-relaxed">{variant.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-between border-b border-border p-5">
            <div>
              <h2 className="font-display text-xl font-bold">Campanhas</h2>
              <p className="text-xs text-muted">Ative, pause e acompanhe disparos automaticos.</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-bold text-muted">
              <SlidersHorizontal className="h-4 w-4" />
              {campaigns.length} total
            </span>
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

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-bold uppercase text-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none focus:border-primary"
      />
    </label>
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
