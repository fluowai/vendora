import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Clock3,
  Copy,
  Eye,
  FileSpreadsheet,
  GripVertical,
  ImageIcon,
  Link2,
  Loader2,
  MessageSquareText,
  Pause,
  PhoneCall,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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

type ContactStats = {
  total: number
  valid: number
  invalid: number
  duplicates: number
};

type StepDefinition = {
  id: number
  title: string
  subtitle: string
};

type LinkItem = {
  id: string
  type: "link" | "media"
  url: string
  label: string
};

type FlowCard = {
  id: string
  kind: "message" | "delay" | "condition" | "finish"
  title: string
  body: string
};

type AutomationRule = {
  id: string
  trigger: string
  action: string
  detail: string
};

const steps: StepDefinition[] = [
  { id: 1, title: "Configurar campanha", subtitle: "Dados basicos, mensagem inicial e importacao." },
  { id: 2, title: "Publico", subtitle: "Qualidade da lista, filtros e saneamento." },
  { id: 3, title: "Sequencia de mensagens", subtitle: "Fluxo de abordagem, variacoes e anexos." },
  { id: 4, title: "Inteligencia do disparo", subtitle: "Instancias, IA responsavel e protecoes." },
  { id: 5, title: "Automacoes", subtitle: "Regras condicionais e respostas automaticas." },
  { id: 6, title: "Revisao", subtitle: "Checklist final antes de publicar." },
];

const defaultLinks: LinkItem[] = [
  { id: "link-1", type: "link", url: "", label: "" },
  { id: "media-1", type: "media", url: "", label: "" },
];

const defaultFlow: FlowCard[] = [
  { id: "flow-1", kind: "message", title: "Mensagem 1", body: "Apresentacao com contexto, dor e gancho consultivo." },
  { id: "flow-2", kind: "delay", title: "Esperar 2 minutos", body: "Delay inteligente com leve aleatoriedade." },
  { id: "flow-3", kind: "message", title: "Mensagem 2", body: "Prova social curta com CTA para resposta." },
  { id: "flow-4", kind: "condition", title: "Aguardando resposta", body: "Se responder, mover para trilha apropriada." },
  { id: "flow-5", kind: "message", title: "Mensagem 3", body: "Seguimento com variacao mais direta." },
  { id: "flow-6", kind: "finish", title: "Finalizar", body: "Encerrar sequencia e registrar resultado." },
];

const defaultRules: AutomationRule[] = [
  { id: "rule-1", trigger: "Respondeu SIM", action: "Mover para funil", detail: "Enviar para etapa Qualificado." },
  { id: "rule-2", trigger: "Perguntou PRECO", action: "Criar ticket", detail: "Abrir atendimento comercial prioritario." },
  { id: "rule-3", trigger: "Respondeu AGENDAR", action: "Criar tarefa", detail: "Agendar follow-up com o time." },
  { id: "rule-4", trigger: "Respondeu NAO", action: "Finalizar campanha", detail: "Encerrar e etiquetar como sem interesse." },
];

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) return `55${digits}`;
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

function parseContactStats(rawContacts: string, contacts: ContactRow[]): ContactStats {
  const lines = rawContacts.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalized = lines
    .map((line) => line.split(/[;,|\t]/).map((part) => part.trim()))
    .map((parts) => parts.find((part) => normalizePhone(part).length >= 10) || "")
    .map((value) => normalizePhone(value))
    .filter(Boolean);

  return {
    total: lines.length,
    valid: contacts.length,
    invalid: Math.max(lines.length - normalized.length, 0),
    duplicates: Math.max(normalized.length - new Set(normalized).size, 0),
  };
}

function estimateScore({
  objective,
  campaignName,
  contacts,
  selectedSessions,
  introMessage,
  linksList,
}: {
  objective: string
  campaignName: string
  contacts: ContactRow[]
  selectedSessions: string[]
  introMessage: string
  linksList: LinkItem[]
}) {
  let score = 34;
  if (campaignName.trim().length > 6) score += 12;
  if (objective.trim().length > 24) score += 14;
  if (introMessage.trim().length > 20) score += 10;
  if (contacts.length > 0) score += 16;
  if (contacts.length > 100) score += 6;
  if (selectedSessions.length > 0) score += 10;
  if (linksList.some((item) => item.url.trim())) score += 8;
  return Math.min(score, 100);
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [funnels, setFunnels] = useState<any[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState("");
  const [category, setCategory] = useState("consultoria");
  const [objective, setObjective] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [tone, setTone] = useState("consultivo e humano");
  const [introMessage, setIntroMessage] = useState("");
  const [linksList, setLinksList] = useState<LinkItem[]>(defaultLinks);
  const [rawContacts, setRawContacts] = useState("");
  const [fileName, setFileName] = useState("");
  const [variantCount, setVariantCount] = useState(5);
  const [intervalSeconds, setIntervalSeconds] = useState(90);
  const [dailyLimit, setDailyLimit] = useState(250);
  const [rotationStrategy, setRotationStrategy] = useState("round_robin");
  const [activeStep, setActiveStep] = useState(1);
  const [contactSearch, setContactSearch] = useState("");
  const [automationRules] = useState<AutomationRule[]>(defaultRules);
  const [flowCards] = useState<FlowCard[]>(defaultFlow);
  const [blacklistEnabled, setBlacklistEnabled] = useState(true);
  const [dedupeEnabled, setDedupeEnabled] = useState(true);
  const [validateNumbers, setValidateNumbers] = useState(true);
  const [normalizeDdd, setNormalizeDdd] = useState(true);
  const [humanMode, setHumanMode] = useState(true);
  const [businessHours, setBusinessHours] = useState(true);
  const [timezoneMode, setTimezoneMode] = useState("America/Sao_Paulo");
  const [selectedAi, setSelectedAi] = useState(ENGINE_ONE_NAME);
  const [result, setResult] = useState<SmartCampaignResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const contacts = useMemo(() => parseContacts(rawContacts), [rawContacts]);
  const contactStats = useMemo(() => parseContactStats(rawContacts, contacts), [rawContacts, contacts]);
  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) => {
      const haystack = [contact.name, contact.phone, contact.email].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [contacts, contactSearch]);
  const whatsAppConnections = useMemo(
    () => connections.filter((item) => ["whatsmeow", "wahaplus", "whatsapp_cloud"].includes(item.channel?.provider)),
    [connections],
  );
  const contactPreview = filteredContacts.slice(0, 6);
  const campaignScore = useMemo(() => estimateScore({ objective, campaignName, contacts, selectedSessions, introMessage, linksList }), [objective, campaignName, contacts, selectedSessions, introMessage, linksList]);
  const progressValue = (activeStep / steps.length) * 100;
  const links = useMemo(() => linksList.filter((item) => item.type === "link").map((item) => item.url.trim()).filter(Boolean), [linksList]);
  const mediaUrls = useMemo(() => linksList.filter((item) => item.type === "media").map((item) => item.url.trim()).filter(Boolean), [linksList]);
  const selectedInstances = useMemo(() => whatsAppConnections.filter((item) => selectedSessions.includes(item.id)), [whatsAppConnections, selectedSessions]);
  const projectedDays = Math.max(1, Math.ceil((contacts.length || 1) / Math.max(dailyLimit, 1)));
  const estimatedMessages = contacts.length * Math.max(variantCount, 1);

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
    setSelectedSessions((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function updateLinkItem(id: string, field: "url" | "label", value: string) {
    setLinksList((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addLinkItem(type: "link" | "media") {
    setLinksList((current) => [...current, { id: `${type}-${current.length + 1}-${Date.now()}`, type, url: "", label: "" }]);
  }

  function removeLinkItem(id: string) {
    setLinksList((current) => current.length === 1 ? current : current.filter((item) => item.id !== id));
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

  function validateCurrentStep() {
    if (activeStep === 1) {
      if (!campaignName.trim()) return "Defina um nome para a campanha.";
      if (!objective.trim()) return "Informe o objetivo da campanha.";
      if (contacts.length === 0) return "Importe ou cole pelo menos um contato valido.";
    }
    if (activeStep === 4 && selectedSessions.length === 0) {
      return "Selecione pelo menos uma instancia WhatsApp.";
    }
    return "";
  }

  function goNext() {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setActiveStep((current) => Math.min(current + 1, steps.length));
  }

  function goPrevious() {
    setError("");
    setActiveStep((current) => Math.max(current - 1, 1));
  }

  function saveDraft() {
    setNotice("Rascunho salvo localmente. A integracao de persistencia pode ser conectada no proximo passo.");
  }

  async function createCampaign() {
    setError("");
    setNotice("");
    if (!objective.trim()) {
      setError("Informe o objetivo da campanha.");
      return;
    }
    if (contacts.length === 0) {
      setError("Importe uma lista com telefones validos.");
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
        links,
        mediaUrls,
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
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] shadow-[0_24px_80px_rgba(15,118,110,0.08)]">
        <div className="border-b border-[#E2E8F0] px-5 py-4 lg:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>Campanhas</span>
                <ChevronRight className="h-4 w-4" />
                <span>Nova campanha inteligente</span>
                <ChevronRight className="h-4 w-4" />
                <span className="font-semibold text-slate-700">Etapa {activeStep} de {steps.length}</span>
              </div>
              <h1 className="mt-2 text-3xl font-display font-bold text-slate-900">Nova campanha inteligente</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Crie campanhas automatizadas com rotacao entre IAs, protecao anti-bloqueio e uma jornada guiada de publicacao.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveDraft}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#CBD5E1] hover:bg-slate-50"
              >
                Salvar rascunho
              </button>
              <button
                type="button"
                onClick={loadData}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#CBD5E1] hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#0F766E] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,118,110,0.24)] transition hover:bg-[#0c635c]"
              >
                <Sparkles className="h-4 w-4" />
                Ajuda da IA
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full max-w-xl">
              <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0F766E_0%,#34D399_100%)]"
                  animate={{ width: `${progressValue}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#ECFDF5] px-3 py-1 text-[#0F766E]">
                <BadgeCheck className="h-3.5 w-3.5" />
                Score {campaignScore}/100
              </span>
              <span>{contacts.length} contatos</span>
              <span>{selectedSessions.length} instancias</span>
              <span>{variantCount} variacoes</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 lg:mx-8">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {notice && (
          <div className="mx-5 mt-5 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 lg:mx-8">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        )}

        <div className="grid gap-6 p-5 lg:p-8 2xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="space-y-4">
            <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 shadow-[0_12px_38px_rgba(15,23,42,0.05)]">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Etapa atual</p>
              <div className="mt-5 space-y-4">
                {steps.map((step) => {
                  const isActive = step.id === activeStep;
                  const isPast = step.id < activeStep;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveStep(step.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition",
                        isActive ? "bg-[#F0FDFA]" : "hover:bg-slate-50",
                      )}
                    >
                      <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-bold",
                        isActive && "border-[#0F766E] bg-[#0F766E] text-white",
                        isPast && "border-[#A7F3D0] bg-[#ECFDF5] text-[#0F766E]",
                        !isActive && !isPast && "border-[#E2E8F0] bg-white text-slate-500",
                      )}>
                        {step.id}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-semibold", isActive ? "text-[#0F766E]" : "text-slate-800")}>{step.title}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{step.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#D1FAE5] bg-[linear-gradient(180deg,#F5FFFB_0%,#ECFDF5_100%)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0F766E]">
                <Sparkles className="h-4 w-4" />
                Dica rapida
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Use a etapa 3 para gerar variacoes com IA e elevar seu score antes de publicar.
              </p>
              <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl border border-[#B7E9D4] bg-white px-4 text-sm font-semibold text-[#0F766E]">
                <Eye className="h-4 w-4" />
                Ver tutorial
              </button>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="flex flex-col gap-4 border-b border-[#E2E8F0] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,#0F766E_0%,#115E59_100%)] text-xl font-bold text-white shadow-[0_18px_30px_rgba(15,118,110,0.24)]">
                    {activeStep}
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-bold text-slate-900">{steps[activeStep - 1].title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{steps[activeStep - 1].subtitle}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-sm text-slate-500">
                  Tudo aparece em blocos menores para evitar sobrecarga visual.
                </div>
              </div>

              <div className="min-h-[720px] px-5 py-6 lg:px-7">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -18, scale: 0.985 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                  >
                    {activeStep === 1 && (
                      <StepShell
                        title="Informacoes basicas"
                        description="Defina os pilares da campanha e suba a base inicial sem expor o usuario a todos os campos de uma vez."
                      >
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                          <div className="space-y-6">
                            <SectionCard title="Contexto da campanha" icon={FileSpreadsheet}>
                              <div className="grid gap-4 md:grid-cols-2">
                                <Field label="Nome da campanha">
                                  <input
                                    value={campaignName}
                                    onChange={(event) => setCampaignName(event.target.value)}
                                    className={fieldClassName}
                                    placeholder="Ex: Campanha de consultoria - Julho"
                                  />
                                </Field>
                                <Field label="Categoria">
                                  <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClassName}>
                                    <option value="consultoria">Consultoria</option>
                                    <option value="vendas">Vendas</option>
                                    <option value="renovacao">Renovacao</option>
                                    <option value="reativacao">Reativacao</option>
                                  </select>
                                </Field>
                                <Field label="Funil">
                                  <select value={funnelId} onChange={(event) => setFunnelId(event.target.value)} className={fieldClassName}>
                                    <option value="">Selecione o funil</option>
                                    {funnels.map((funnel) => (
                                      <option key={funnel.id} value={funnel.id}>{funnel.name}</option>
                                    ))}
                                  </select>
                                </Field>
                                <Field label="Tom da campanha">
                                  <select value={tone} onChange={(event) => setTone(event.target.value)} className={fieldClassName}>
                                    <option value="consultivo e humano">Consultivo e humano</option>
                                    <option value="direto e comercial">Direto e comercial</option>
                                    <option value="premium e discreto">Premium e discreto</option>
                                    <option value="leve e conversacional">Leve e conversacional</option>
                                  </select>
                                </Field>
                              </div>
                              <Field label="Objetivo comercial da campanha">
                                <textarea
                                  value={objective}
                                  onChange={(event) => setObjective(event.target.value)}
                                  className={textAreaClassName}
                                  rows={5}
                                  placeholder="Descreva o objetivo, publico e resultado esperado da campanha."
                                />
                              </Field>
                            </SectionCard>

                            <SectionCard title="Contatos da campanha" icon={Upload}>
                              <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-[#BFE3DD] bg-[linear-gradient(180deg,#FBFFFE_0%,#F0FDFA_100%)] p-6 text-center transition hover:border-[#0F766E]">
                                {parsing ? <Loader2 className="h-8 w-8 animate-spin text-[#0F766E]" /> : <Upload className="h-8 w-8 text-[#0F766E]" />}
                                <div>
                                  <p className="text-lg font-semibold text-slate-900">{fileName || "Importe sua lista de contatos"}</p>
                                  <p className="mt-2 text-sm text-slate-500">Arraste ou selecione um arquivo .xlsx, .xls, .csv ou .txt</p>
                                </div>
                                <span className="rounded-xl border border-[#CCFBF1] bg-white px-4 py-2 text-sm font-semibold text-[#0F766E]">
                                  Selecionar arquivo
                                </span>
                                <input
                                  type="file"
                                  accept=".xlsx,.xls,.csv,.txt"
                                  className="hidden"
                                  onChange={(event) => handleFile(event.target.files?.[0])}
                                />
                              </label>

                              <div className="grid gap-3 md:grid-cols-3">
                                <MiniStat label="Importados" value={contactStats.valid} hint="Contatos validos para disparo" />
                                <MiniStat label="Duplicados" value={contactStats.duplicates} hint="Numeros repetidos detectados" />
                                <MiniStat label="Invalidos" value={contactStats.invalid} hint="Linhas sem telefone reconhecido" />
                              </div>
                            </SectionCard>
                          </div>

                          <div className="space-y-6">
                            <SectionCard title="Mensagem de apresentacao" icon={MessageSquareText}>
                              <Field label="Mensagem inicial opcional">
                                <textarea
                                  value={introMessage}
                                  onChange={(event) => setIntroMessage(event.target.value)}
                                  className={textAreaClassName}
                                  rows={9}
                                  placeholder="Escreva uma mensagem de apresentacao enviada antes da sequencia principal..."
                                />
                              </Field>
                              <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D1FAE5] bg-[#F0FDFA] px-4 text-sm font-semibold text-[#0F766E]">
                                <Wand2 className="h-4 w-4" />
                                Gerar com IA
                              </button>
                            </SectionCard>

                            <SectionCard title="Links e midias" icon={Link2}>
                              <div className="space-y-3">
                                {linksList.map((item) => (
                                  <div key={item.id} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_44px]">
                                    <div className="relative">
                                      <span className="pointer-events-none absolute left-3 top-3.5 text-slate-400">
                                        {item.type === "link" ? <Link2 className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                                      </span>
                                      <input
                                        value={item.url}
                                        onChange={(event) => updateLinkItem(item.id, "url", event.target.value)}
                                        className={cn(fieldClassName, "pl-10")}
                                        placeholder={item.type === "link" ? "https://exemplo.com" : "https://exemplo.com/imagem.jpg"}
                                      />
                                    </div>
                                    <input
                                      value={item.label}
                                      onChange={(event) => updateLinkItem(item.id, "label", event.target.value)}
                                      className={fieldClassName}
                                      placeholder="Descricao"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeLinkItem(item.id)}
                                      className="inline-flex h-12 items-center justify-center rounded-2xl border border-[#E2E8F0] text-slate-500 transition hover:bg-slate-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-3">
                                <button type="button" onClick={() => addLinkItem("link")} className={ghostButtonClassName}>
                                  <Plus className="h-4 w-4" />
                                  Adicionar link
                                </button>
                                <button type="button" onClick={() => addLinkItem("media")} className={ghostButtonClassName}>
                                  <Plus className="h-4 w-4" />
                                  Adicionar midia
                                </button>
                              </div>
                            </SectionCard>
                          </div>
                        </div>
                      </StepShell>
                    )}

                    {activeStep === 2 && (
                      <StepShell
                        title="Higienizacao do publico"
                        description="Revise a qualidade da base, aplique filtros e veja uma previa antes do disparo."
                      >
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="space-y-6">
                            <SectionCard title="Ferramentas de limpeza" icon={ShieldCheck}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <ToggleRow label="Remover duplicados" value={dedupeEnabled} onClick={() => setDedupeEnabled((value) => !value)} />
                                <ToggleRow label="Validar numeros" value={validateNumbers} onClick={() => setValidateNumbers((value) => !value)} />
                                <ToggleRow label="Normalizar DDD" value={normalizeDdd} onClick={() => setNormalizeDdd((value) => !value)} />
                                <ToggleRow label="Aplicar blacklist" value={blacklistEnabled} onClick={() => setBlacklistEnabled((value) => !value)} />
                              </div>
                            </SectionCard>

                            <SectionCard title="Tabela de contatos" icon={Search}>
                              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div className="relative w-full md:max-w-sm">
                                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                                  <input
                                    value={contactSearch}
                                    onChange={(event) => setContactSearch(event.target.value)}
                                    className={cn(fieldClassName, "pl-10")}
                                    placeholder="Pesquisar por nome, telefone ou email"
                                  />
                                </div>
                                <button type="button" onClick={() => setContactSearch("")} className={ghostButtonClassName}>
                                  Limpar filtros
                                </button>
                              </div>

                              <div className="overflow-hidden rounded-[22px] border border-[#E2E8F0]">
                                <div className="grid grid-cols-[1.3fr_1fr_1fr_120px] gap-3 bg-[#F8FAFC] px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                                  <span>Contato</span>
                                  <span>Telefone</span>
                                  <span>Email</span>
                                  <span>Status</span>
                                </div>
                                <div className="divide-y divide-[#E2E8F0]">
                                  {contactPreview.length === 0 ? (
                                    <div className="px-4 py-10 text-center text-sm text-slate-500">
                                      Nenhum contato para mostrar ainda.
                                    </div>
                                  ) : contactPreview.map((contact, index) => (
                                    <div key={`${contact.phone}-${index}`} className="grid grid-cols-[1.3fr_1fr_1fr_120px] gap-3 px-4 py-3 text-sm text-slate-600">
                                      <span className="font-semibold text-slate-800">{contact.name || "Sem nome"}</span>
                                      <span>{contact.phone}</span>
                                      <span className="truncate">{contact.email || "-"}</span>
                                      <span className="font-semibold text-emerald-600">Valido</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </SectionCard>
                          </div>

                          <div className="space-y-6">
                            <SectionCard title="Indicadores" icon={BadgeCheck}>
                              <div className="grid gap-3">
                                <MiniStat label="Total de contatos" value={contactStats.total} hint="Linhas recebidas na importacao" />
                                <MiniStat label="Contatos validos" value={contactStats.valid} hint="Base pronta para o envio" />
                                <MiniStat label="Duplicados" value={contactStats.duplicates} hint="Podem ser removidos automaticamente" />
                                <MiniStat label="Invalidos" value={contactStats.invalid} hint="Precisam de correcao antes do disparo" />
                              </div>
                            </SectionCard>

                            <SectionCard title="Acoes rapidas" icon={Settings2}>
                              <div className="space-y-3">
                                <button className={ghostButtonClassName}>Adicionar tags de campanha</button>
                                <button className={ghostButtonClassName}>Permitir importar mais contatos</button>
                                <button className={ghostButtonClassName}>Baixar modelo de planilha</button>
                              </div>
                            </SectionCard>
                          </div>
                        </div>
                      </StepShell>
                    )}

                    {activeStep === 3 && (
                      <StepShell
                        title="Construtor de sequencia"
                        description="Monte um fluxo com cards, esperas e condicoes, mantendo espaco para IA gerar variacoes premium."
                      >
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <div className="space-y-4">
                            {flowCards.map((card, index) => (
                              <div key={card.id} className="space-y-4">
                                <motion.div layout className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div className="flex items-start gap-4">
                                      <div className={cn(
                                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                                        card.kind === "message" && "bg-[#ECFDF5] text-[#0F766E]",
                                        card.kind === "delay" && "bg-[#FFF7ED] text-[#C2410C]",
                                        card.kind === "condition" && "bg-[#EFF6FF] text-[#1D4ED8]",
                                        card.kind === "finish" && "bg-[#F8FAFC] text-slate-600",
                                      )}>
                                        {card.kind === "message" && <MessageSquareText className="h-5 w-5" />}
                                        {card.kind === "delay" && <Clock3 className="h-5 w-5" />}
                                        {card.kind === "condition" && <RotateCw className="h-5 w-5" />}
                                        {card.kind === "finish" && <BadgeCheck className="h-5 w-5" />}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-3">
                                          <h3 className="text-lg font-semibold text-slate-900">{card.title}</h3>
                                          <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-slate-500">
                                            {card.kind}
                                          </span>
                                        </div>
                                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{card.body}</p>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                      <IconPill icon={GripVertical} label="Mover" />
                                      <IconPill icon={Copy} label="Duplicar" />
                                      <IconPill icon={Trash2} label="Excluir" />
                                      <IconPill icon={Wand2} label="Editar" />
                                    </div>
                                  </div>

                                  {card.kind === "message" && (
                                    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                      <button className={chipClassName}>Variaveis</button>
                                      <button className={chipClassName}>Imagem</button>
                                      <button className={chipClassName}>Video</button>
                                      <button className={chipClassName}>PDF</button>
                                      <button className={chipClassName}>Audio</button>
                                      <button className={chipClassName}>Documento</button>
                                    </div>
                                  )}
                                </motion.div>
                                {index < flowCards.length - 1 && (
                                  <div className="flex justify-center">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D1FAE5] bg-[#F0FDFA] text-[#0F766E]">
                                      <ArrowDownIcon />
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="space-y-6">
                            <SectionCard title="Recursos de IA" icon={Bot}>
                              <div className="grid gap-3">
                                <button className={ghostButtonClassName}>Reescrever com IA</button>
                                <button className={ghostButtonClassName}>Criar versao formal</button>
                                <button className={ghostButtonClassName}>Criar versao curta</button>
                                <button className={ghostButtonClassName}>Criar versao comercial</button>
                                <button className={ghostButtonClassName}>Criar versao amigavel</button>
                              </div>
                            </SectionCard>

                            <SectionCard title="Teste A/B" icon={Sparkles}>
                              <Field label="Quantidade de variacoes">
                                <input
                                  type="number"
                                  value={variantCount}
                                  min={3}
                                  max={12}
                                  onChange={(event) => setVariantCount(Number(event.target.value))}
                                  className={fieldClassName}
                                />
                              </Field>
                              <p className="text-sm leading-6 text-slate-500">
                                O mecanismo atual usa esse valor no blueprint da campanha para produzir variacoes automaticamente.
                              </p>
                            </SectionCard>
                          </div>
                        </div>
                      </StepShell>
                    )}

                    {activeStep === 4 && (
                      <StepShell
                        title="Orquestracao inteligente"
                        description="Ajuste instancias, IA responsavel e limites de seguranca para distribuir o volume com mais naturalidade."
                      >
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
                          <div className="space-y-6">
                            <SectionCard title="Rotacao entre instancias" icon={RotateCw}>
                              <div className="grid gap-3 md:grid-cols-2">
                                <Field label="Modo de rotacao">
                                  <select value={rotationStrategy} onChange={(event) => setRotationStrategy(event.target.value)} className={fieldClassName}>
                                    <option value="round_robin">Round Robin</option>
                                    <option value="balanced">Balanceamento</option>
                                    <option value="priority">Prioridade</option>
                                    <option value="random">Aleatorio</option>
                                  </select>
                                </Field>
                                <Field label="IA responsavel">
                                  <select value={selectedAi} onChange={(event) => setSelectedAi(event.target.value)} className={fieldClassName}>
                                    <option value={ENGINE_ONE_NAME}>{ENGINE_ONE_NAME}</option>
                                    <option value={ENGINE_TWO_NAME}>{ENGINE_TWO_NAME}</option>
                                    <option value="WooTech IA Comercial">WooTech IA Comercial</option>
                                    <option value="WooTech IA SDR">WooTech IA SDR</option>
                                  </select>
                                </Field>
                              </div>
                              <div className="grid gap-3">
                                {whatsAppConnections.length === 0 ? (
                                  <div className="rounded-[22px] border border-dashed border-[#E2E8F0] px-4 py-10 text-center text-sm text-slate-500">
                                    Nenhuma conexao WhatsApp encontrada.
                                  </div>
                                ) : whatsAppConnections.map((connection) => (
                                  <button
                                    key={connection.id}
                                    type="button"
                                    onClick={() => toggleSession(connection.id)}
                                    className={cn(
                                      "flex items-center justify-between rounded-[22px] border px-4 py-4 text-left transition",
                                      selectedSessions.includes(connection.id)
                                        ? "border-[#0F766E] bg-[#F0FDFA]"
                                        : "border-[#E2E8F0] bg-white hover:bg-slate-50",
                                    )}
                                  >
                                    <div>
                                      <p className="font-semibold text-slate-900">{connection.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">{connection.channel?.provider} • status {connection.status}</p>
                                    </div>
                                    <div className={cn(
                                      "rounded-full px-3 py-1 text-xs font-semibold",
                                      ["connected", "active"].includes(connection.status) ? "bg-[#ECFDF5] text-[#0F766E]" : "bg-[#F8FAFC] text-slate-500",
                                    )}>
                                      {["connected", "active"].includes(connection.status) ? "Online" : "Offline"}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </SectionCard>

                            <SectionCard title="Protecoes de envio" icon={ShieldCheck}>
                              <div className="grid gap-4 md:grid-cols-3">
                                <Field label="Intervalo entre mensagens (s)">
                                  <input type="number" value={intervalSeconds} min={15} max={3600} onChange={(event) => setIntervalSeconds(Number(event.target.value))} className={fieldClassName} />
                                </Field>
                                <Field label="Limite diario">
                                  <input type="number" value={dailyLimit} min={1} max={5000} onChange={(event) => setDailyLimit(Number(event.target.value))} className={fieldClassName} />
                                </Field>
                                <Field label="Fuso horario">
                                  <select value={timezoneMode} onChange={(event) => setTimezoneMode(event.target.value)} className={fieldClassName}>
                                    <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                                    <option value="America/Manaus">America/Manaus</option>
                                    <option value="America/Fortaleza">America/Fortaleza</option>
                                  </select>
                                </Field>
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                <ToggleRow label="Modo humano" value={humanMode} onClick={() => setHumanMode((value) => !value)} />
                                <ToggleRow label="Horario comercial" value={businessHours} onClick={() => setBusinessHours((value) => !value)} />
                              </div>
                            </SectionCard>
                          </div>

                          <div className="space-y-6">
                            <SectionCard title="Capacidade estimada" icon={Clock3}>
                              <div className="grid gap-3">
                                <MiniStat label="Instancias ativas" value={selectedSessions.length} hint="Usadas na rotacao atual" />
                                <MiniStat label="Disparos previstos" value={contacts.length} hint="Total de contatos da rodada" />
                                <MiniStat label="Tempo estimado" value={`${projectedDays} dia(s)`} hint="Baseado no limite diario configurado" />
                              </div>
                            </SectionCard>

                            <SectionCard title="Politicas enterprise" icon={CircleOff}>
                              <div className="space-y-3 text-sm leading-6 text-slate-600">
                                <p>Anti bloqueio com pausas aleatorias.</p>
                                <p>Distribuicao equilibrada entre instancias.</p>
                                <p>Janela de envio por horario comercial.</p>
                                <p>Controle de frequencia por contato.</p>
                              </div>
                            </SectionCard>
                          </div>
                        </div>
                      </StepShell>
                    )}

                    {activeStep === 5 && (
                      <StepShell
                        title="Automacoes e respostas"
                        description="Transforme respostas em acoes de CRM, atendimento ou novos disparos sem sair do fluxo."
                      >
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
                          <div className="space-y-4">
                            {automationRules.map((rule) => (
                              <div key={rule.id} className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_60px_minmax(0,1fr)] md:items-center">
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Quando</p>
                                    <div className="mt-3 rounded-2xl border border-[#D1FAE5] bg-[#F0FDFA] px-4 py-4 text-sm font-semibold text-[#0F766E]">
                                      {rule.trigger}
                                    </div>
                                  </div>
                                  <div className="flex justify-center">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F8FAFC] text-slate-400">→</div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Entao</p>
                                    <div className="mt-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 text-sm">
                                      <p className="font-semibold text-slate-900">{rule.action}</p>
                                      <p className="mt-1 text-slate-500">{rule.detail}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-6">
                            <SectionCard title="Biblioteca de acoes" icon={Plus}>
                              <div className="grid gap-3">
                                <button className={ghostButtonClassName}>Enviar webhook</button>
                                <button className={ghostButtonClassName}>Executar API</button>
                                <button className={ghostButtonClassName}>Adicionar tag</button>
                                <button className={ghostButtonClassName}>Mover pipeline</button>
                                <button className={ghostButtonClassName}>Transferir humano</button>
                                <button className={ghostButtonClassName}>Notificar equipe</button>
                              </div>
                            </SectionCard>

                            <SectionCard title="Modo de teste" icon={ShieldCheck}>
                              <p className="text-sm leading-6 text-slate-600">
                                Envie apenas para contatos internos enquanto valida automacoes, score e coerencia da sequencia.
                              </p>
                            </SectionCard>
                          </div>
                        </div>
                      </StepShell>
                    )}

                    {activeStep === 6 && (
                      <StepShell
                        title="Revisao final"
                        description="Confira indicadores, capacidade operacional e checklist antes de iniciar os disparos."
                      >
                        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                          <div className="space-y-6">
                            <SectionCard title="Dashboard da campanha" icon={BadgeCheck}>
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <MiniStat label="Contatos" value={contacts.length} hint="Base valida para envio" />
                                <MiniStat label="Mensagens previstas" value={estimatedMessages} hint="Estimativa considerando variacoes" />
                                <MiniStat label="Instancias usadas" value={selectedSessions.length} hint="Rotacao ativa" />
                                <MiniStat label="IA selecionada" value={selectedAi} hint="Motor principal do fluxo" />
                                <MiniStat label="Automacoes" value={automationRules.length} hint="Regras habilitadas" />
                                <MiniStat label="Estimativa" value={`${projectedDays} dia(s)`} hint="Tempo aproximado para concluir" />
                              </div>
                            </SectionCard>

                            <SectionCard title="Checklist de validacao" icon={CheckCircle2}>
                              <div className="space-y-3">
                                <ChecklistItem checked={Boolean(campaignName.trim())} text="Campanha possui nome e contexto definidos." />
                                <ChecklistItem checked={Boolean(objective.trim())} text="Objetivo comercial preenchido." />
                                <ChecklistItem checked={contacts.length > 0} text="Lista de contatos importada com sucesso." />
                                <ChecklistItem checked={selectedSessions.length > 0} text="Instancias selecionadas para a rotacao." />
                                <ChecklistItem checked={campaignScore >= 70} text="Score de qualidade acima do minimo recomendado." />
                              </div>
                            </SectionCard>

                            {result?.blueprint?.variants?.length ? (
                              <SectionCard title="Preview de mensagens geradas" icon={MessageSquareText}>
                                <div className="grid gap-3 lg:grid-cols-2">
                                  {result.blueprint.variants.map((variant, index) => (
                                    <div key={`${variant.title}-${index}`} className="rounded-[22px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                                      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{variant.title || `Variacao ${index + 1}`}</p>
                                      <p className="mt-3 text-sm leading-6 text-slate-600">{variant.body}</p>
                                    </div>
                                  ))}
                                </div>
                              </SectionCard>
                            ) : null}
                          </div>

                          <div className="space-y-6">
                            <SectionCard title="Previsoes" icon={Sparkles}>
                              <div className="space-y-4">
                                <ForecastRow label="Taxa de abertura" value="76%" />
                                <ForecastRow label="Taxa de resposta" value="22%" />
                                <ForecastRow label="Tempo medio" value="4h 30min" />
                                <ForecastRow label="Consumo estimado" value={`${estimatedMessages} mensagens`} />
                              </div>
                            </SectionCard>

                            <SectionCard title="Publicacao" icon={Send}>
                              <div className="space-y-3">
                                <button
                                  type="button"
                                  onClick={saveDraft}
                                  className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  Salvar rascunho
                                </button>
                                <button
                                  type="button"
                                  onClick={createCampaign}
                                  disabled={creating}
                                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F766E] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,118,110,0.24)] transition hover:bg-[#0c635c] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                  Iniciar campanha
                                </button>
                              </div>
                            </SectionCard>
                          </div>
                        </div>
                      </StepShell>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="flex flex-col gap-4 border-t border-[#E2E8F0] px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
                <button
                  type="button"
                  onClick={goPrevious}
                  disabled={activeStep === 1}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>

                <div className="flex items-center justify-center gap-2">
                  {steps.map((step) => (
                    <span key={step.id} className={cn("h-2.5 w-2.5 rounded-full", step.id === activeStep ? "bg-[#0F766E]" : "bg-[#CBD5E1]")} />
                  ))}
                </div>

                {activeStep < steps.length ? (
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0F766E] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,118,110,0.24)] transition hover:bg-[#0c635c]"
                  >
                    Proxima etapa
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={createCampaign}
                    disabled={creating}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#0F766E] px-5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,118,110,0.24)] transition hover:bg-[#0c635c] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Publicar campanha
                  </button>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 shadow-[0_12px_38px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Resumo ao vivo</p>
                    <h3 className="mt-2 text-lg font-display font-bold text-slate-900">Painel lateral</h3>
                  </div>
                  <div className="rounded-full bg-[#ECFDF5] px-3 py-1 text-xs font-semibold text-[#0F766E]">
                    Atualizado
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  <SummaryRow label="Nome" value={campaignName || "Nova campanha inteligente"} />
                  <SummaryRow label="Contatos" value={String(contacts.length)} />
                  <SummaryRow label="Instancias" value={String(selectedSessions.length)} />
                  <SummaryRow label="IA" value={selectedAi} />
                  <SummaryRow label="Mensagens" value={String(estimatedMessages)} />
                  <SummaryRow label="Automacoes" value={String(automationRules.length)} />
                  <SummaryRow label="Tempo" value={`${projectedDays} dia(s)`} />
                  <SummaryRow label="Custo est." value={`Score ${campaignScore}/100`} />
                </div>
              </div>

              <div className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 shadow-[0_12px_38px_rgba(15,23,42,0.05)]">
                <p className="text-sm font-semibold text-slate-900">Capacidade das instancias</p>
                <div className="mt-4 space-y-3">
                  {selectedInstances.length === 0 ? (
                    <p className="text-sm text-slate-500">Selecione instancias na etapa 4 para ver a distribuicao.</p>
                  ) : selectedInstances.map((instance) => (
                    <div key={instance.id} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-800">{instance.name}</span>
                        <span className="text-xs text-slate-500">{instance.status}</span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
                        <div className="h-full rounded-full bg-[#0F766E]" style={{ width: `${Math.max(24, Math.min(92, Math.round(100 / selectedInstances.length)))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-5 lg:px-7">
          <div>
            <h2 className="text-2xl font-display font-bold text-slate-900">Campanhas existentes</h2>
            <p className="mt-1 text-sm text-slate-500">Acompanhe disparos criados, status e resultados operacionais.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#F8FAFC] px-3 py-1 text-xs font-semibold text-slate-500">
            <Settings2 className="h-4 w-4" />
            {campaigns.length} total
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center p-6 text-center text-sm text-slate-500">
            Nenhuma campanha cadastrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_auto] lg:items-center lg:px-7">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{campaign.name}</h3>
                    <span className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]",
                      campaign.status === "active" && "bg-emerald-50 text-emerald-700",
                      campaign.status === "paused" && "bg-amber-50 text-amber-700",
                      campaign.status === "cancelled" && "bg-red-50 text-red-700",
                      !["active", "paused", "cancelled"].includes(campaign.status) && "bg-[#F8FAFC] text-slate-500",
                    )}>
                      {campaign.status}
                    </span>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm text-slate-500">{campaign.description || campaign.mode}</p>
                  <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
                    <span>{campaign.totalContacts || campaign._count?.contacts || 0} contatos</span>
                    <span>{campaign.calledCount || 0} chamadas</span>
                    <span>{campaign.answeredCount || 0} atendidas</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton icon={Play} label="Iniciar" onClick={() => updateCampaign(campaign.id, "start")} />
                  <ActionButton icon={Pause} label="Pausar" onClick={() => updateCampaign(campaign.id, "pause")} />
                  <ActionButton icon={XCircle} label="Cancelar" danger onClick={() => updateCampaign(campaign.id, "cancel")} />
                  <div className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 text-xs font-semibold text-slate-500">
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
  );
}

const fieldClassName = "h-12 w-full rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#0F766E] focus:ring-4 focus:ring-[#CCFBF1]";
const textAreaClassName = "w-full rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#0F766E] focus:ring-4 focus:ring-[#CCFBF1]";
const ghostButtonClassName = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#CBD5E1] hover:bg-slate-50";
const chipClassName = "inline-flex h-10 items-center justify-center rounded-xl border border-[#D1FAE5] bg-[#F0FDFA] px-3 text-sm font-semibold text-[#0F766E] transition hover:bg-[#DCFCE7]";

function StepShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Wizard premium</p>
        <h3 className="mt-2 text-xl font-display font-bold text-slate-900">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof FileSpreadsheet
  children: React.ReactNode
}) {
  return (
    <section className="rounded-[24px] border border-[#E2E8F0] bg-white p-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)]">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F0FDFA] text-[#0F766E]">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint: string
}) {
  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-display font-bold text-slate-900">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-500">{hint}</p>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onClick,
}: {
  label: string
  value: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-[20px] border border-[#E2E8F0] bg-white px-4 py-3 text-left transition hover:bg-slate-50"
    >
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className={cn(
        "flex h-7 w-12 items-center rounded-full p-1 transition",
        value ? "bg-[#0F766E] justify-end" : "bg-[#CBD5E1] justify-start",
      )}>
        <span className="h-5 w-5 rounded-full bg-white shadow-sm" />
      </span>
    </button>
  );
}

function IconPill({
  icon: Icon,
  label,
}: {
  icon: typeof Copy
  label: string
}) {
  return (
    <button className="inline-flex h-9 items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[#F8FAFC] px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="max-w-[170px] truncate text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function ForecastRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function ChecklistItem({
  checked,
  text,
}: {
  checked: boolean
  text: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
      <div className={cn(
        "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full",
        checked ? "bg-[#0F766E] text-white" : "bg-slate-200 text-slate-500",
      )}>
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
      <span className="text-sm text-slate-600">{text}</span>
    </div>
  );
}

function ArrowDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <path d="M12 5V19M12 19L6 13M12 19L18 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
        "inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold transition",
        danger ? "border-red-100 bg-red-50 text-red-700" : "border-[#E2E8F0] bg-[#F8FAFC] text-slate-700 hover:bg-slate-100",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
