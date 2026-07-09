import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Phone,
  Upload,
  XCircle,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

type ParsedContact = {
  name?: string
  phone: string
  email?: string
  metadata?: Record<string, unknown>
};

type WaSession = {
  id: string
  name: string
  jid: string
  state: string
  paired: boolean
};

type ValidationResult = {
  input: string
  phone: string
  whatsappPhone?: string
  name?: string
  email?: string
  jid?: string
  lid?: string
  isOnWhatsApp: boolean
  pushName?: string
  businessName?: string
  avatarUrl?: string
  photoStatus?: string
  error?: string
};

type ValidationResponse = {
  sessionId: string
  campaign?: { id: string; name: string } | null
  saveWarning?: string | null
  summary: {
    total: number
    uniquePhones: number
    valid: number
    invalid: number
    errors: number
  }
  results: ValidationResult[]
};

function authHeaders() {
  const token = localStorage.getItem("vendaora_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    return `55${digits}`;
  }
  return digits;
}

function looksLikePhone(value: unknown) {
  const phone = normalizePhone(value);
  return phone.length >= 10 && phone.length <= 15;
}

function columnIndex(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.some((name) => header.includes(name)));
}

function rowsToContacts(rows: unknown[][]) {
  const nonEmpty = rows.filter((row) => row.some((cell) => String(cell || "").trim()));
  if (nonEmpty.length === 0) return [];

  const first = nonEmpty[0].map((cell) => String(cell || "").trim().toLowerCase());
  const hasHeader = first.some((cell) => ["telefone", "phone", "celular", "whatsapp", "nome", "name", "email"].includes(cell));
  const headers = hasHeader ? first : [];
  const dataRows = hasHeader ? nonEmpty.slice(1) : nonEmpty;

  const phoneIdx = hasHeader
    ? columnIndex(headers, ["telefone", "phone", "celular", "whatsapp", "numero", "número"])
    : -1;
  const nameIdx = hasHeader ? columnIndex(headers, ["nome", "name", "cliente", "contato"]) : -1;
  const emailIdx = hasHeader ? columnIndex(headers, ["email", "e-mail"]) : -1;

  return dataRows.map((row) => {
    const phoneCell = phoneIdx >= 0 ? row[phoneIdx] : row.find(looksLikePhone);
    const phone = normalizePhone(phoneCell);
    if (!phone) return null;

    const name = nameIdx >= 0 ? String(row[nameIdx] || "").trim() : "";
    const email = emailIdx >= 0 ? String(row[emailIdx] || "").trim() : "";
    return {
      name,
      phone,
      email,
      metadata: {
        raw: row.map((cell) => String(cell || "").trim()),
      },
    };
  }).filter(Boolean) as ParsedContact[];
}

async function parseMailingFile(file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt") {
    const text = await file.text();
    const rows = text.split(/\r?\n/).map((line) => line.split(/[;\t,]/).map((cell) => cell.trim()));
    return rowsToContacts(rows);
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, raw: false });
  return rowsToContacts(rows);
}

function exportCsv(results: ValidationResult[]) {
  const headers = ["telefone", "status", "nome", "pushname", "empresa", "foto", "status_foto", "email", "erro"];
  const lines = results.map((row) => [
    row.phone,
    row.isOnWhatsApp ? "whatsapp" : "sem_whatsapp",
    row.name || "",
    row.pushName || "",
    row.businessName || "",
    row.avatarUrl || "",
    row.photoStatus || "",
    row.email || "",
    row.error || "",
  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"));
  const blob = new Blob([[headers.join(";"), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mailing-validado.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function Campaigns() {
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [fileName, setFileName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [saveValid, setSaveValid] = useState(true);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<ValidationResponse | null>(null);

  useEffect(() => {
    fetch("/api/calls/sessions", { headers: authHeaders() })
      .then((res) => res.json())
      .then((payload) => {
        const rows = payload.sessions || [];
        setSessions(rows);
        const connected = rows.find((session: WaSession) => session.paired && session.state === "open") || rows[0];
        if (connected) setSessionId(connected.id);
      })
      .catch(() => setError("Nao foi possivel carregar as sessoes WaCalls."));
  }, []);

  const stats = useMemo(() => {
    if (data) return data.summary;
    return {
      total: contacts.length,
      uniquePhones: new Set(contacts.map((contact) => contact.phone)).size,
      valid: 0,
      invalid: 0,
      errors: 0,
    };
  }, [contacts, data]);

  async function handleFile(file?: File) {
    if (!file) return;
    setParsing(true);
    setError("");
    setData(null);
    try {
      const parsed = await parseMailingFile(file);
      setContacts(parsed);
      setFileName(file.name);
      if (!campaignName) {
        setCampaignName(file.name.replace(/\.[^.]+$/, ""));
      }
      if (parsed.length === 0) {
        setError("Nao encontrei telefones validos no arquivo.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler arquivo.");
    } finally {
      setParsing(false);
    }
  }

  async function validateMailing() {
    if (contacts.length === 0) {
      setError("Suba um arquivo com telefones antes de validar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/mailing/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ contacts, sessionId, saveValid, campaignName }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Erro ao validar mailing.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao validar mailing.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1">Mailing Call Center</h1>
          <p className="text-muted">Valide listas, confirme WhatsApp e prepare campanhas para ligacao.</p>
        </div>
        <button
          type="button"
          onClick={() => data && exportCsv(data.results)}
          disabled={!data}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Linhas" value={stats.total} />
        <StatCard label="Unicos" value={stats.uniquePhones} />
        <StatCard label="Com WhatsApp" value={stats.valid} accent="success" />
        <StatCard label="Sem WhatsApp" value={stats.invalid} accent="danger" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold">Validar lista</h2>
              <p className="text-xs text-muted">Excel, CSV ou TXT com telefone, nome e email.</p>
            </div>
          </div>

          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-bg p-6 text-center transition hover:border-primary">
            {parsing ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <Upload className="h-8 w-8 text-primary" />}
            <div>
              <p className="text-sm font-bold">{fileName || "Selecionar arquivo"}</p>
              <p className="text-xs text-muted">.xlsx, .xls, .csv ou .txt ate 2.000 contatos</p>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </label>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-muted">Sessao WhatsApp</span>
              <select
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} {session.paired ? "(conectada)" : "(offline)"}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase text-muted">Nome da campanha</span>
              <input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm outline-none"
                placeholder="Ex: Recuperacao julho"
              />
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={saveValid}
                onChange={(event) => setSaveValid(event.target.checked)}
                className="h-4 w-4"
              />
              Salvar numeros validos como campanha em rascunho
            </label>

            {error && (
              <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={validateMailing}
              disabled={loading || parsing || contacts.length === 0}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              Validar mailing
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold">Resultado</h2>
              <p className="text-xs text-muted">
                {data?.campaign ? `Campanha criada: ${data.campaign.name}` : "Aguardando validacao do mailing."}
              </p>
            </div>
            {data && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                {data.summary.valid} validos
              </span>
            )}
          </div>

          {data?.saveWarning && (
            <div className="mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{data.saveWarning}</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase text-muted">
                  <th className="pb-3 font-bold">Contato</th>
                  <th className="pb-3 font-bold">Telefone</th>
                  <th className="pb-3 font-bold">WhatsApp</th>
                  <th className="pb-3 font-bold">Pushname</th>
                  <th className="pb-3 font-bold">Foto</th>
                  <th className="pb-3 font-bold">Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.results || contacts.slice(0, 50)).map((row: any, index) => (
                  <tr key={`${row.phone}-${index}`} className="hover:bg-bg/50">
                    <td className="py-3">
                      <div className="font-bold">{row.name || row.businessName || row.pushName || "Sem nome"}</div>
                      <div className="text-xs text-muted">{row.email || ""}</div>
                    </td>
                    <td className="py-3 font-mono text-xs">{row.phone}</td>
                    <td className="py-3">
                      {data ? (
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold",
                          row.isOnWhatsApp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
                        )}>
                          {row.isOnWhatsApp ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {row.isOnWhatsApp ? "Sim" : "Nao"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Pendente</span>
                      )}
                    </td>
                    <td className="py-3">{row.pushName || row.businessName || "-"}</td>
                    <td className="py-3">
                      {row.avatarUrl ? (
                        <img src={row.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-xs font-bold text-muted">
                            {String(row.name || row.phone || "?").slice(0, 1)}
                          </div>
                          {data && (
                            <span className="max-w-24 text-[11px] leading-tight text-muted">
                              {row.photoStatus || "foto nao retornada"}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 text-xs text-red-600">{row.error || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!data && contacts.length > 50 && (
            <p className="mt-3 text-xs text-muted">Mostrando amostra de 50 contatos antes da validacao.</p>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "success" | "danger" }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className={cn(
        "mt-1 text-2xl font-display font-bold",
        accent === "success" && "text-green-600",
        accent === "danger" && "text-red-600",
      )}>
        {value}
      </p>
    </div>
  );
}
