import { useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Bot,
  Camera,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/lib/api"

type SectionId = "profile" | "prompt" | "channels" | "automation"

type AgentFormState = {
  name: string
  description: string
  segment: string
  provider: string
  model: string
  systemPrompt: string
  temperature: number
  channels: string[]
  status: string
  avatarUrl: string
  autonomyMode: string
  businessGoal: string
  fallbackInstructions: string
  whatsappInstanceIds: string[]
  supportAgentIds: string[]
  allowedTools: string[]
  escalationKeywords: string[] | string
}

const segments = [
  { id: "vendas", label: "Vendas" },
  { id: "suporte", label: "Suporte" },
  { id: "retencao", label: "Retencao" },
  { id: "saude", label: "Saude" },
  { id: "juridico", label: "Juridico" },
  { id: "educacao", label: "Educacao" },
  { id: "imobiliario", label: "Imobiliario" },
  { id: "financeiro", label: "Financeiro" },
  { id: "rh", label: "RH" },
  { id: "logistica", label: "Logistica" },
  { id: "ecommerce", label: "E-commerce" },
]

const providers = [
  { id: "gemini", label: "Google Gemini", hint: "Rapido e economico" },
  { id: "openai", label: "OpenAI", hint: "Conversas complexas" },
  { id: "anthropic", label: "Anthropic Claude", hint: "Analise e seguranca" },
  { id: "groq", label: "Groq", hint: "Baixa latencia" },
]

const channels = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "web", label: "Web Chat" },
  { id: "email", label: "E-mail" },
  { id: "telegram", label: "Telegram" },
  { id: "discord", label: "Discord" },
]

const agentTools = [
  { id: "update_contact", label: "Atualizar contato" },
  { id: "create_ticket", label: "Criar ticket" },
  { id: "create_deal", label: "Criar negocio" },
  { id: "create_appointment", label: "Criar agendamento" },
  { id: "list_available_slots", label: "Listar horarios" },
  { id: "search_knowledge", label: "Buscar conhecimento" },
]

const promptTemplates: Record<string, string> = {
  vendas: "Voce e um SDR consultivo. Qualifique leads, identifique dor, contexto, urgencia e capacidade de compra. Faca perguntas curtas, registre dados relevantes e convide para o proximo passo quando houver fit. Nao prometa condicoes que nao estejam confirmadas.",
  suporte: "Voce e um agente de suporte. Diagnostique o problema com calma, confirme dados essenciais, explique o passo a passo e escale para humano quando houver risco, bloqueio tecnico ou solicitacao direta do cliente.",
  retencao: "Voce e um assistente de pos-venda. Entenda satisfacao, identifique risco de cancelamento, colete feedback e ofereca caminhos claros para resolver a situacao.",
  saude: "Voce e um assistente de triagem em saude. Colete sintomas e dados de atendimento, mas nunca de diagnostico definitivo. Oriente procurar atendimento urgente em sinais de risco.",
  juridico: "Voce e um assistente juridico informativo. Explique conceitos gerais, organize documentos e deixe claro que nao substitui aconselhamento de advogado.",
  educacao: "Voce e um tutor educacional. Explique com didatica, adapte a resposta ao nivel do aluno e cheque entendimento antes de avancar.",
  imobiliario: "Voce e um corretor virtual. Qualifique interesse, regiao, orcamento, prazo e perfil do imovel. Sugira visitas quando houver fit.",
  financeiro: "Voce e um assistente financeiro conservador. Ajude com simulacoes e informacoes gerais, sem prometer retorno ou dar recomendacao personalizada de investimento.",
  rh: "Voce e um assistente de RH. Ajude na triagem, agendamento e onboarding com tom justo, profissional e inclusivo.",
  logistica: "Voce e um assistente de logistica. Informe prazos, fretes e rastreios de forma objetiva, confirmando identificadores antes de responder.",
  ecommerce: "Voce e um vendedor de e-commerce. Tire duvidas sobre produtos, estoque, pagamento e entrega. Recomende itens com base na necessidade do cliente.",
}

const sections: { id: SectionId; label: string; icon: any; desc: string }[] = [
  { id: "profile", label: "Perfil", icon: Bot, desc: "Nome, segmento e canais gerais" },
  { id: "prompt", label: "Prompt", icon: FileText, desc: "Modelo e prompt system" },
  { id: "channels", label: "Vinculos", icon: Smartphone, desc: "WhatsApp e multiagente" },
  { id: "automation", label: "Autonomia", icon: ShieldCheck, desc: "Ferramentas e handoff" },
]

function normalizeKeywords(value: string[] | string) {
  return Array.isArray(value)
    ? value
    : value.split(",").map((item) => item.trim()).filter(Boolean)
}

function connectionIdentity(connection: any) {
  const config = connection.config || {}
  const phone = connection.phone || config.phone || ""
  const jid = connection.jid || config.jid || ""
  const label = connection.pushName || connection.businessName || config.pushName || config.businessName || connection.name
  return {
    label,
    phone: phone || (jid ? jid.split("@")[0] : ""),
    connected: connection.status === "connected" || !!connection.connectedAt || !!config.connectedAt,
  }
}

function agentLinkedToConnection(agent: any, connectionId: string) {
  const ids = agent?.handoffRules?.whatsappInstanceIds
  return Array.isArray(ids) && ids.includes(connectionId)
}

export function AgentForm({
  onClose,
  onSave,
  initial,
  agents = [],
}: {
  onClose: () => void
  onSave: (data: any) => void
  initial?: any
  agents?: any[]
}) {
  const existingRules = initial?.handoffRules || {}
  const [activeSection, setActiveSection] = useState<SectionId>("profile")
  const [form, setForm] = useState<AgentFormState>({
    name: initial?.name || "",
    description: initial?.description || "",
    segment: initial?.segment || "vendas",
    provider: initial?.llmConfig?.provider || "gemini",
    model: initial?.llmConfig?.model || "gemini-3-flash-preview",
    systemPrompt: initial?.llmConfig?.systemPrompt || promptTemplates.vendas,
    temperature: initial?.llmConfig?.temperature ?? 0.7,
    channels: initial?.channels || ["web"],
    status: initial?.status || "draft",
    avatarUrl: initial?.avatar || "",
    autonomyMode: existingRules.autonomyMode || "supervised",
    businessGoal: existingRules.businessGoal || "",
    fallbackInstructions: existingRules.fallbackInstructions || "Transferir para humano quando o cliente pedir, quando houver risco financeiro/juridico/saude ou quando faltar informacao para responder com seguranca.",
    whatsappInstanceIds: existingRules.whatsappInstanceIds || [],
    supportAgentIds: existingRules.supportAgentIds || [],
    allowedTools: existingRules.allowedTools || [],
    escalationKeywords: existingRules.escalationKeywords || "humano, atendente, cancelar, reembolso, urgente, reclamacao",
  })
  const [uploading, setUploading] = useState(false)
  const [connections, setConnections] = useState<any[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConnectionsLoading(true)
    api.getConnections()
      .then((data) => {
        setConnections(data.connections.filter((item) =>
          item.channel?.provider === "whatsmeow" || item.channel?.provider === "whatsapp_cloud"
        ))
      })
      .catch(() => setConnections([]))
      .finally(() => setConnectionsLoading(false))
  }, [])

  const availableSupportAgents = useMemo(
    () => agents.filter((agent) => agent.id !== initial?.id),
    [agents, initial?.id],
  )

  const currentStepIndex = sections.findIndex((section) => section.id === activeSection)
  const selectedConnections = connections.filter((connection) => form.whatsappInstanceIds.includes(connection.id))
  const promptCharacters = form.systemPrompt.length
  const hasWhatsAppChannel = form.channels.includes("whatsapp")
  const whatsappNeedsBinding = hasWhatsAppChannel && form.whatsappInstanceIds.length === 0

  async function handleAvatarUpload(file: File) {
    if (!file) return
    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1]
        const res = await api.uploadAvatar(base64, file.type)
        setForm((f) => ({ ...f, avatarUrl: res.url }))
      }
      reader.readAsDataURL(file)
    } finally {
      setUploading(false)
    }
  }

  const handleSegmentChange = (seg: string) => {
    setForm((f) => ({
      ...f,
      segment: seg,
      systemPrompt: promptTemplates[seg] || f.systemPrompt,
    }))
  }

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter((item) => item !== ch)
        : [...f.channels, ch],
    }))
  }

  const toggleWhatsAppInstance = (id: string) => {
    setForm((f) => {
      const selected = f.whatsappInstanceIds.includes(id)
        ? f.whatsappInstanceIds.filter((item) => item !== id)
        : [...f.whatsappInstanceIds, id]
      return {
        ...f,
        whatsappInstanceIds: selected,
        channels: selected.length > 0 && !f.channels.includes("whatsapp") ? [...f.channels, "whatsapp"] : f.channels,
      }
    })
  }

  const toggleSupportAgent = (id: string) => {
    setForm((f) => ({
      ...f,
      supportAgentIds: f.supportAgentIds.includes(id)
        ? f.supportAgentIds.filter((item) => item !== id)
        : [...f.supportAgentIds, id],
    }))
  }

  const toggleAllowedTool = (id: string) => {
    setForm((f) => ({
      ...f,
      allowedTools: f.allowedTools.includes(id)
        ? f.allowedTools.filter((item) => item !== id)
        : [...f.allowedTools, id],
    }))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { avatarUrl, autonomyMode, businessGoal, fallbackInstructions, whatsappInstanceIds, supportAgentIds, allowedTools, escalationKeywords, ...rest } = form
    onSave({
      ...rest,
      avatar: avatarUrl || undefined,
      llmConfig: {
        provider: rest.provider,
        model: rest.model,
        systemPrompt: rest.systemPrompt,
        temperature: rest.temperature,
      },
      handoffRules: {
        ...(initial?.handoffRules || {}),
        autonomyMode,
        businessGoal,
        fallbackInstructions,
        whatsappInstanceIds,
        supportAgentIds,
        allowedTools,
        escalationKeywords: normalizeKeywords(escalationKeywords),
      },
    })
  }

  const goToOffset = (offset: number) => {
    const next = sections[currentStepIndex + offset]
    if (next) setActiveSection(next.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border w-full max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-xl truncate">{initial ? "Configurar agente" : "Criar agente"}</h2>
              <p className="text-xs text-muted truncate">Defina prompt, canais e autonomia sem perder o contexto.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-bg rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid h-[calc(92vh-76px)] grid-cols-1 lg:grid-cols-[270px_1fr]">
          <aside className="hidden lg:flex flex-col border-r border-border bg-bg/60 p-4">
            <div className="space-y-2">
              {sections.map((section, index) => {
                const Icon = section.icon
                const active = activeSection === section.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-all",
                      active ? "bg-surface border-primary/40 shadow-sm" : "bg-transparent border-transparent hover:bg-surface hover:border-border"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                        active ? "bg-primary text-white" : "bg-surface border border-border text-muted"
                      )}>
                        {active ? <Icon className="w-4 h-4" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold">{section.label}</span>
                        <span className="block text-[11px] text-muted truncate">{section.desc}</span>
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-auto rounded-xl border border-border bg-surface p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-3">Resumo ativo</p>
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Status</span>
                  <span className="font-bold capitalize">{form.status}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">WhatsApp</span>
                  <span className={cn("font-bold", whatsappNeedsBinding ? "text-amber-600" : "text-text")}>
                    {form.whatsappInstanceIds.length} vinculo(s)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Apoios</span>
                  <span className="font-bold">{form.supportAgentIds.length}</span>
                </div>
                {whatsappNeedsBinding && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-[11px] font-semibold text-amber-800">
                    WhatsApp selecionado sem numero vinculado. Ele nao respondera automaticamente.
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto">
            <div className="lg:hidden flex gap-1 overflow-x-auto border-b border-border p-3">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap",
                    activeSection === section.id ? "bg-primary text-white" : "bg-bg text-muted"
                  )}
                >
                  {section.label}
                </button>
              ))}
            </div>

            <div className="p-5 lg:p-7 space-y-6">
              {activeSection === "profile" && (
                <section className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center gap-5">
                    <div className="relative w-fit">
                      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden">
                        {form.avatarUrl ? (
                          <img src={form.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <Bot className="w-9 h-9 text-primary" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute -right-2 -bottom-2 w-9 h-9 bg-primary text-white rounded-xl flex items-center justify-center border-2 border-surface hover:bg-primary/90 transition-all"
                        title="Trocar avatar"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nome do agente</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Ex: SDR Vendas, Suporte tecnico..."
                        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all"
                        required
                      />
                      <p className="text-[11px] text-muted mt-2">Esse nome aparece em testes, historico e rastreio de respostas.</p>
                    </div>
                    <div className="w-full md:w-48">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                      >
                        <option value="draft">Rascunho</option>
                        <option value="active">Ativo</option>
                        <option value="paused">Pausado</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Segmento</label>
                    <div className="flex flex-wrap gap-2">
                      {segments.map((seg) => (
                        <button
                          key={seg.id}
                          type="button"
                          onClick={() => handleSegmentChange(seg.id)}
                          className={cn(
                            "px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                            form.segment === seg.id ? "bg-primary text-white border-primary" : "bg-bg text-muted border-border hover:border-primary/30"
                          )}
                        >
                          {seg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Descricao interna</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Descreva o objetivo, publico, tom e limite do agente..."
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-28"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Canais habilitados</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {channels.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => toggleChannel(ch.id)}
                          className={cn(
                            "rounded-xl border px-3 py-3 text-left text-xs font-bold transition-all",
                            form.channels.includes(ch.id) ? "bg-primary/10 text-primary border-primary/30" : "bg-bg text-muted border-border hover:border-primary/30"
                          )}
                        >
                          {ch.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {activeSection === "prompt" && (
                <section className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-5">
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Provedor de IA</label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {providers.map((provider) => (
                          <button
                            key={provider.id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, provider: provider.id }))}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-all",
                              form.provider === provider.id ? "bg-primary/10 text-primary border-primary/30" : "bg-bg text-muted border-border hover:border-primary/30"
                            )}
                          >
                            <span className="block text-xs font-bold">{provider.label}</span>
                            <span className="block text-[10px] mt-1">{provider.hint}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Modelo</label>
                      <input
                        value={form.model}
                        onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-2">
                      <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-wider block">System prompt</label>
                        <p className="text-xs text-muted mt-1">Regras permanentes do agente. Quanto mais especifico, menor a chance de resposta fora do combinado.</p>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        {promptCharacters.toLocaleString("pt-BR")} caracteres
                      </div>
                    </div>
                    <textarea
                      value={form.systemPrompt}
                      onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                      spellCheck={false}
                      className="min-h-[360px] w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-xl px-4 py-4 text-sm outline-none focus:border-primary/60 transition-all resize-y font-mono leading-relaxed"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, systemPrompt: promptTemplates[f.segment] || f.systemPrompt }))}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs font-bold text-muted hover:text-primary"
                      >
                        <Sparkles className="w-4 h-4" /> Reaplicar template do segmento
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, systemPrompt: `${f.systemPrompt.trim()}\n\nRegras de seguranca:\n- Se faltar informacao, faca uma pergunta objetiva antes de concluir.\n- Nunca invente preco, prazo, disponibilidade ou politicas.\n- Transfira para humano quando o cliente pedir ou houver risco sensivel.` }))}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs font-bold text-muted hover:text-primary"
                      >
                        <ShieldCheck className="w-4 h-4" /> Adicionar guardrails
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Criatividade</label>
                      <span className="text-xs font-bold text-primary">{form.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={form.temperature}
                      onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-[10px] text-muted mt-1">
                      <span>Preciso</span>
                      <span>Criativo</span>
                    </div>
                  </div>
                </section>
              )}

              {activeSection === "channels" && (
                <section className="space-y-6">
                  <div className={cn(
                    "rounded-xl border p-4",
                    whatsappNeedsBinding ? "bg-amber-50 border-amber-100 text-amber-900" : "bg-primary/5 border-primary/15 text-text"
                  )}>
                    <div className="flex items-start gap-3">
                      {whatsappNeedsBinding ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                      <div>
                        <p className="text-sm font-bold">
                          {whatsappNeedsBinding ? "WhatsApp sem agente vinculado" : "Vinculo por instancia"}
                        </p>
                        <p className="text-xs mt-1 leading-relaxed">
                          O WhatsApp so responde automaticamente quando a instancia estiver ligada explicitamente a este agente.
                          Isso evita que uma conta use SDR ou outro agente de outra configuracao por acidente.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-bold">Numeros WhatsApp</h3>
                        <p className="text-xs text-muted mt-1">Selecione quais instancias podem usar este agente.</p>
                      </div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                        {connectionsLoading ? "Carregando..." : `${connections.length} disponiveis`}
                      </span>
                    </div>
                    {connections.length === 0 ? (
                      <div className="p-5 bg-bg border border-border rounded-xl text-sm text-muted flex items-center gap-3">
                        <Smartphone className="w-5 h-5 text-primary" />
                        Nenhuma conexao WhatsApp encontrada. Crie uma instancia em Conexoes para vincular aqui.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {connections.map((connection) => {
                          const view = connectionIdentity(connection)
                          const linkedAgents = agents.filter((agent) => agentLinkedToConnection(agent, connection.id))
                          const selected = form.whatsappInstanceIds.includes(connection.id)
                          return (
                            <button
                              key={connection.id}
                              type="button"
                              onClick={() => toggleWhatsAppInstance(connection.id)}
                              className={cn(
                                "rounded-xl border p-4 text-left transition-all",
                                selected ? "bg-primary/10 border-primary/35" : "bg-bg border-border hover:border-primary/30"
                              )}
                            >
                              <span className="flex items-start justify-between gap-3">
                                <span className="min-w-0">
                                  <span className="flex items-center gap-2">
                                    <span className={cn("h-2.5 w-2.5 rounded-full", view.connected ? "bg-primary" : "bg-amber-400")} />
                                    <span className="font-bold text-sm truncate">{view.label}</span>
                                  </span>
                                  <span className="block text-xs text-muted mt-1 truncate">{view.phone || "Numero nao identificado"}</span>
                                  <span className="block text-[10px] text-muted mt-2">
                                    {linkedAgents.length > 0
                                      ? `Ligado em: ${linkedAgents.map((agent) => agent.id === initial?.id ? "este agente" : agent.name).join(", ")}`
                                      : "Sem agente vinculado"}
                                  </span>
                                </span>
                                {selected ? <CheckCircle2 className="w-5 h-5 text-primary shrink-0" /> : <Plus className="w-5 h-5 text-muted shrink-0" />}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <h3 className="font-bold">Equipe multiagente</h3>
                        <p className="text-xs text-muted mt-1">Especialistas chamados como apoio quando este agente precisar.</p>
                      </div>
                      <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{form.supportAgentIds.length} apoio(s)</span>
                    </div>
                    {availableSupportAgents.length === 0 ? (
                      <div className="p-5 bg-bg border border-border rounded-xl text-sm text-muted flex items-center gap-3">
                        <Users className="w-5 h-5 text-primary" />
                        Crie outros agentes para usar como especialistas de apoio.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availableSupportAgents.map((agent) => {
                          const selected = form.supportAgentIds.includes(agent.id)
                          return (
                            <button
                              key={agent.id}
                              type="button"
                              onClick={() => toggleSupportAgent(agent.id)}
                              className={cn(
                                "rounded-xl border p-4 text-left transition-all flex items-center justify-between gap-3",
                                selected ? "bg-primary/10 border-primary/35 text-primary" : "bg-bg border-border text-muted hover:border-primary/30"
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-bold truncate">{agent.name}</span>
                                <span className="block text-[10px] mt-1 truncate">{agent.segment} | {agent.status}</span>
                              </span>
                              {selected ? <Trash2 className="w-4 h-4 shrink-0" /> : <Plus className="w-4 h-4 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {activeSection === "automation" && (
                <section className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { id: "supervised", label: "Supervisionado", desc: "Responde, mas sinaliza casos sensiveis." },
                      { id: "autonomous", label: "Autonomo", desc: "Atende sem depender do humano." },
                      { id: "handoff_first", label: "Triagem", desc: "Coleta dados e transfere oportunidades." },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, autonomyMode: mode.id }))}
                        className={cn(
                          "p-4 rounded-xl border text-left transition-all",
                          form.autonomyMode === mode.id ? "bg-primary/10 border-primary/30 text-primary" : "bg-bg border-border text-muted hover:border-primary/30"
                        )}
                      >
                        <ShieldCheck className="w-5 h-5 mb-3" />
                        <span className="block text-sm font-bold">{mode.label}</span>
                        <span className="block text-xs mt-1 leading-relaxed">{mode.desc}</span>
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Objetivo operacional</label>
                    <textarea
                      value={form.businessGoal}
                      onChange={(e) => setForm((f) => ({ ...f, businessGoal: e.target.value }))}
                      placeholder="Ex: qualificar leads, responder duvidas, coletar dados e agendar uma reuniao."
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-24"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Ferramentas permitidas</label>
                      <span className="text-[10px] text-muted">{form.allowedTools.length} ativa(s)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {agentTools.map((tool) => (
                        <button
                          key={tool.id}
                          type="button"
                          onClick={() => toggleAllowedTool(tool.id)}
                          className={cn(
                            "p-3 rounded-xl border text-left transition-all text-xs font-bold flex items-center gap-2",
                            form.allowedTools.includes(tool.id) ? "bg-primary/10 border-primary/30 text-primary" : "bg-bg border-border text-muted hover:border-primary/30"
                          )}
                        >
                          <Zap className="w-4 h-4" />
                          {tool.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Palavras de transferencia</label>
                      <input
                        type="text"
                        value={Array.isArray(form.escalationKeywords) ? form.escalationKeywords.join(", ") : form.escalationKeywords}
                        onChange={(e) => setForm((f) => ({ ...f, escalationKeywords: e.target.value }))}
                        placeholder="humano, urgente, cancelar"
                        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Regra de fallback</label>
                      <textarea
                        value={form.fallbackInstructions}
                        onChange={(e) => setForm((f) => ({ ...f, fallbackInstructions: e.target.value }))}
                        className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-24"
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>
          </main>

          <footer className="lg:col-start-2 border-t border-border bg-surface px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted">
              <SlidersHorizontal className="w-4 h-4" />
              <span>{sections[currentStepIndex]?.label} de {sections.length} etapas</span>
              {selectedConnections.length > 0 && <span>| {selectedConnections.length} numero(s) ligado(s)</span>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => goToOffset(-1)}
                disabled={currentStepIndex === 0}
                className="px-4 py-2.5 bg-bg border border-border rounded-xl text-xs font-bold text-muted hover:text-text disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => goToOffset(1)}
                disabled={currentStepIndex === sections.length - 1}
                className="px-4 py-2.5 bg-bg border border-border rounded-xl text-xs font-bold text-muted hover:text-text disabled:opacity-40"
              >
                Proximo
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar agente
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  )
}
