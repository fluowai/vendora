import { useEffect, useState, useRef } from "react"
import { X, Bot, Save, Sparkles, Camera, Smartphone, Users, ShieldCheck, Plus, Trash2 } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/lib/api"

const segments = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'suporte', label: 'Suporte' },
  { id: 'retencao', label: 'Retenção' },
  { id: 'saude', label: 'Saúde' },
  { id: 'juridico', label: 'Jurídico' },
  { id: 'educacao', label: 'Educação' },
  { id: 'imobiliario', label: 'Imobiliário' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'rh', label: 'RH' },
  { id: 'logistica', label: 'Logística' },
  { id: 'ecommerce', label: 'E-commerce' },
]

const providers = [
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic Claude' },
  { id: 'groq', label: 'Groq (Llama/Mixtral)' },
]

const channels = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'web', label: 'Web Chat' },
  { id: 'email', label: 'E-mail' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'discord', label: 'Discord' },
]

const agentTools = [
  { id: 'update_contact', label: 'Atualizar contato' },
  { id: 'create_ticket', label: 'Criar ticket' },
  { id: 'create_deal', label: 'Criar negocio' },
  { id: 'create_appointment', label: 'Criar agendamento' },
  { id: 'list_available_slots', label: 'Listar horarios' },
  { id: 'search_knowledge', label: 'Buscar conhecimento' },
]

const promptTemplates: Record<string, string> = {
  vendas: 'Você é um vendedor especialista. Seu objetivo é qualificar leads, identificar dores e agendar reuniões. Seja persuasivo mas ético.',
  suporte: 'Você é um agente de suporte técnico. Resolva problemas de forma paciente e clara. Escale para humano quando necessário.',
  retencao: 'Você é um assistente de pós-venda. Entre em contato para garantir satisfação, coletar feedback e oferecer produtos complementares.',
  saude: 'Você é um assistente de triagem em saúde. Colete sintomas, oriente o paciente e agende consultas. Nunca dê diagnósticos definitivos.',
  juridico: 'Você é um assistente jurídico. Preste informações gerais, ajude com documentos simples. Informe que não substitui um advogado.',
  educacao: 'Você é um tutor educacional. Seja didático e paciente. Adapte-se ao nível do aluno e incentive o aprendizado.',
  imobiliario: 'Você é um corretor virtual. Apresente imóveis, agende visitas e qualifique compradores. Destaque benefícios sem exagerar.',
  financeiro: 'Você é um analista financeiro. Seja conservador. Ajude com simulações e informações gerais sobre crédito e investimentos.',
  rh: 'Você é um assistente de RH. Ajude na triagem de currículos, agendamento de entrevistas e onboarding. Seja justo e profissional.',
  logistica: 'Você é um assistente de logística. Forneça informações sobre fretes, prazos e rastreios de forma objetiva.',
  ecommerce: 'Você é um vendedor de e-commerce. Recomende produtos, tire dúvidas sobre estoque e pagamento. Ajude na conversão.',
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
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    segment: initial?.segment || 'vendas',
    provider: initial?.llmConfig?.provider || 'gemini',
    model: initial?.llmConfig?.model || 'gemini-3-flash-preview',
    systemPrompt: initial?.llmConfig?.systemPrompt || promptTemplates.vendas,
    temperature: initial?.llmConfig?.temperature ?? 0.7,
    channels: initial?.channels || ['web'],
    status: initial?.status || 'draft',
    avatarUrl: initial?.avatar || '',
    autonomyMode: existingRules.autonomyMode || 'supervised',
    businessGoal: existingRules.businessGoal || '',
    fallbackInstructions: existingRules.fallbackInstructions || 'Transferir para humano quando o cliente pedir, quando houver risco financeiro/juridico/saude ou quando faltar informacao para responder com seguranca.',
    whatsappInstanceIds: existingRules.whatsappInstanceIds || [],
    supportAgentIds: existingRules.supportAgentIds || [],
    allowedTools: existingRules.allowedTools || [],
    escalationKeywords: existingRules.escalationKeywords || 'humano, atendente, cancelar, reembolso, urgente, reclamacao',
  })
  const [uploading, setUploading] = useState(false)
  const [connections, setConnections] = useState<any[]>([])
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setConnectionsLoading(true)
    api.getConnections()
      .then((data) => {
        setConnections(data.connections.filter((item) => item.channel?.provider === "whatsmeow" || item.channel?.provider === "whatsapp_cloud"))
      })
      .catch(() => setConnections([]))
      .finally(() => setConnectionsLoading(false))
  }, [])

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
    } catch (e: any) {
      console.error(e)
    }
    setUploading(false)
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
        ? f.channels.filter((c: string) => c !== ch)
        : [...f.channels, ch],
    }))
  }

  const toggleWhatsAppInstance = (id: string) => {
    setForm((f) => ({
      ...f,
      whatsappInstanceIds: f.whatsappInstanceIds.includes(id)
        ? f.whatsappInstanceIds.filter((item: string) => item !== id)
        : [...f.whatsappInstanceIds, id],
      channels: f.channels.includes('whatsapp') ? f.channels : [...f.channels, 'whatsapp'],
    }))
  }

  const toggleSupportAgent = (id: string) => {
    setForm((f) => ({
      ...f,
      supportAgentIds: f.supportAgentIds.includes(id)
        ? f.supportAgentIds.filter((item: string) => item !== id)
        : [...f.supportAgentIds, id],
    }))
  }

  const toggleAllowedTool = (id: string) => {
    setForm((f) => ({
      ...f,
      allowedTools: f.allowedTools.includes(id)
        ? f.allowedTools.filter((item: string) => item !== id)
        : [...f.allowedTools, id],
    }))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const { avatarUrl, autonomyMode, businessGoal, fallbackInstructions, whatsappInstanceIds, supportAgentIds, allowedTools, escalationKeywords, ...rest } = form
    const escalationList = Array.isArray(escalationKeywords)
      ? escalationKeywords
      : escalationKeywords
        .split(',')
        .map((item: string) => item.trim())
        .filter(Boolean)
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
        escalationKeywords: escalationList,
      },
    })
  }

  const availableSupportAgents = agents.filter((agent) => agent.id !== initial?.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface rounded-[2rem] border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="sticky top-0 bg-surface z-10 flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">{initial ? 'Configurar Agente' : 'Criar Novo Agente'}</h2>
              <p className="text-xs text-muted">Configure seu agente de IA personalizado</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-bg rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nome do Agente</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: SDR Vendas, Tutor Matemática..."
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Descreva o propósito e personalidade do agente..."
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-20"
                required
              />
            </div>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-8 h-8 text-primary" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center border-2 border-surface hover:bg-primary/90 transition-all"
              >
                <Camera className="w-3 h-3" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
              />
            </div>
            <div>
              <p className="text-xs font-bold">Avatar do Agente</p>
              <p className="text-[10px] text-muted">PNG, JPG ou WebP · Máx 5MB</p>
            </div>
          </div>

          {/* Segment */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Segmento</label>
            <div className="flex flex-wrap gap-2">
              {segments.map((seg) => (
                <button
                  key={seg.id}
                  type="button"
                  onClick={() => handleSegmentChange(seg.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                    form.segment === seg.id
                      ? "bg-primary text-white border-primary"
                      : "bg-bg text-muted border-border hover:border-primary/30"
                  )}
                >
                  {seg.label}
                </button>
              ))}
            </div>
          </div>

          {/* LLM Provider */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Modelo de IA</label>
            <div className="flex gap-2 mb-3">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, provider: p.id }))}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all",
                    form.provider === p.id
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-bg text-muted border-border hover:border-primary/30"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Prompt do Sistema</label>
              <span className="text-[10px] text-muted italic">Personalidade e regras do agente</span>
            </div>
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-32 font-mono"
            />
            <div className="flex items-center gap-2 mt-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[10px] text-muted">O prompt muda automaticamente conforme o segmento selecionado</span>
            </div>
          </div>

          {/* Autonomy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Objetivo operacional</label>
              <textarea
                value={form.businessGoal}
                onChange={(e) => setForm((f) => ({ ...f, businessGoal: e.target.value }))}
                placeholder="Ex: qualificar leads, responder duvidas, coletar dados e agendar uma reuniao."
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-28"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Modo de autonomia</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { id: 'supervised', label: 'Supervisionado', desc: 'Responde sozinho, mas sinaliza casos sensiveis.' },
                  { id: 'autonomous', label: 'Autonomo', desc: 'Atende clientes sem depender do humano.' },
                  { id: 'handoff_first', label: 'Triagem', desc: 'Coleta dados e transfere quando detectar oportunidade.' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, autonomyMode: mode.id }))}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all",
                      form.autonomyMode === mode.id
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-bg border-border text-muted hover:border-primary/30"
                    )}
                  >
                    <span className="flex items-center gap-2 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4" /> {mode.label}
                    </span>
                    <span className="block text-[10px] mt-1 leading-relaxed">{mode.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Criatividade (Temperature)</label>
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
            <div className="flex justify-between text-[9px] text-muted mt-0.5">
              <span>Preciso</span>
              <span>Criativo</span>
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Canais</label>
            <div className="flex flex-wrap gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => toggleChannel(ch.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all",
                    form.channels.includes(ch.id)
                      ? "bg-primary text-white border-primary"
                      : "bg-bg text-muted border-border hover:border-primary/30"
                  )}
                >
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* WhatsApp bindings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Numeros de WhatsApp vinculados</label>
              <span className="text-[10px] text-muted">{connectionsLoading ? 'Carregando...' : `${connections.length} disponiveis`}</span>
            </div>
            {connections.length === 0 ? (
              <div className="p-4 bg-bg border border-border rounded-xl text-xs text-muted flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-primary" />
                Nenhuma conexao WhatsApp encontrada. Cadastre uma instancia em Conexoes para vincular aqui.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {connections.map((connection) => (
                  <button
                    key={connection.id}
                    type="button"
                    onClick={() => toggleWhatsAppInstance(connection.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3",
                      form.whatsappInstanceIds.includes(connection.id)
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-bg border-border text-muted hover:border-primary/30"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold truncate">{connection.name}</span>
                      <span className="block text-[10px] truncate">{connection.channel?.provider || 'whatsapp'}</span>
                    </span>
                    <Smartphone className="w-4 h-4 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Multi-agent */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Equipe multiagente</label>
              <span className="text-[10px] text-muted">{form.supportAgentIds.length} apoio(s)</span>
            </div>
            {availableSupportAgents.length === 0 ? (
              <div className="p-4 bg-bg border border-border rounded-xl text-xs text-muted flex items-center gap-3">
                <Users className="w-4 h-4 text-primary" />
                Crie outros agentes para usar como especialistas de apoio.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {availableSupportAgents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    onClick={() => toggleSupportAgent(agent.id)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3",
                      form.supportAgentIds.includes(agent.id)
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-bg border-border text-muted hover:border-primary/30"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-bold truncate">{agent.name}</span>
                      <span className="block text-[10px] truncate">{agent.segment} | {agent.status}</span>
                    </span>
                    {form.supportAgentIds.includes(agent.id) ? <Trash2 className="w-4 h-4 shrink-0" /> : <Plus className="w-4 h-4 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Ferramentas autonomas permitidas</label>
              <span className="text-[10px] text-muted">{form.allowedTools.length} ativa(s)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {agentTools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => toggleAllowedTool(tool.id)}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all text-xs font-bold",
                    form.allowedTools.includes(tool.id)
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-bg border-border text-muted hover:border-primary/30"
                  )}
                >
                  {tool.label}
                </button>
              ))}
            </div>
          </div>

          {/* Handoff rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Palavras de transferencia</label>
              <input
                type="text"
                value={Array.isArray(form.escalationKeywords) ? form.escalationKeywords.join(', ') : form.escalationKeywords}
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
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all resize-none h-20"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Tags</label>
            <input
              type="text"
              placeholder="vendas, qualificacao, lead-generation"
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-bg border border-border rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] bg-primary text-white py-3 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {initial ? 'Salvar Agente' : 'Criar Agente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
