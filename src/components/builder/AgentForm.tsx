import { useState } from "react"
import { X, Bot, Save, Sparkles } from "lucide-react"
import { cn } from "@/src/lib/utils"

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
}: {
  onClose: () => void
  onSave: (data: any) => void
  initial?: any
}) {
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
  })

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSave({
      ...form,
      llmConfig: {
        provider: form.provider,
        model: form.model,
        systemPrompt: form.systemPrompt,
        temperature: form.temperature,
      },
    })
  }

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
