import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bot, Plus, Sparkles, Link, Store, Layers,
  Briefcase, HelpCircle, Target, Clock, Scale,
  Heart, BookOpen, Home, DollarSign, Users, ShoppingCart
} from "lucide-react"
import { api } from "@/src/lib/api"
import { AgentCard } from "@/src/components/agents/AgentCard"
import { AgentForm } from "@/src/components/builder/AgentForm"

const templateIcon: Record<string, any> = {
  vendas: Briefcase, suporte: HelpCircle, retencao: Target,
  saude: Heart, juridico: Scale, educacao: BookOpen,
  imobiliario: Home, financeiro: DollarSign, rh: Users,
  logistica: Clock, ecommerce: ShoppingCart,
}

const templates = [
  { id: 'vendas', title: 'Vendedor SDR', desc: 'Foco em conversão e qualificação de leads.' },
  { id: 'suporte', title: 'Suporte Nível 1', desc: 'Resolve dúvidas comuns e escala problemas.' },
  { id: 'retencao', title: 'Recuperação de Carrinho', desc: 'Reativa leads frios com ofertas.' },
  { id: 'saude', title: 'Triagem Saúde', desc: 'Pré-triagem de pacientes e agendamento.' },
  { id: 'juridico', title: 'Assistente Jurídico', desc: 'Informações legais e minutas.' },
  { id: 'educacao', title: 'Tutor Virtual', desc: 'Auxilia alunos com dúvidas.' },
  { id: 'imobiliario', title: 'Corretor Virtual', desc: 'Apresenta imóveis e agenda visitas.' },
  { id: 'financeiro', title: 'Analista Financeiro', desc: 'Simula crédito e organiza finanças.' },
]

export default function Agents() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)

  useEffect(() => {
    api.getAgents().then((res) => {
      setAgents(res.agents)
    }).finally(() => setLoading(false))
  }, [])

  const handleCreateFromTemplate = async (segment: string) => {
    try {
      const res = await api.createAgent({
        name: `Novo ${segment.charAt(0).toUpperCase() + segment.slice(1)}`,
        description: 'Agente criado a partir de template.',
        segment,
        status: 'draft',
        llmConfig: { provider: 'gemini', model: 'gemini-3-flash-preview', temperature: 0.7 },
        channels: ['web'],
        isPublished: false,
        authorId: 'user',
        authorName: 'Usuário',
        tags: [segment],
      })
      setAgents((prev) => [...prev, res.agent])
      navigate(`/app/agents/${res.agent.id}`)
    } catch (e: any) {
      alert(`Erro: ${e.message}`)
    }
  }

  const handleCreateCustom = async (data: any) => {
    try {
      const res = await api.createAgent({
        ...data,
        isPublished: false,
        installs: 0,
        rating: 0,
        authorId: 'user',
        authorName: 'Usuário',
      })
      setAgents((prev) => [...prev, res.agent])
      setShowBuilder(false)
      navigate(`/app/agents/${res.agent.id}`)
    } catch (e: any) {
      alert(`Erro: ${e.message}`)
    }
  }

  const handleToggleStatus = (id: string) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === 'active' ? 'paused' : 'active' }
          : a
      )
    )
    const agent = agents.find((a) => a.id === id)
    if (agent) {
      api.updateAgent(id, { status: agent.status === 'active' ? 'paused' : 'active' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return
    await api.deleteAgent(id)
    setAgents((prev) => prev.filter((a) => a.id !== id))
  }

  const myAgents = agents.filter((a) => a.authorId !== 'system')
  const storeAgents = agents.filter((a) => a.isPublished && a.authorId === 'system')

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Fábrica de Agentes</span>
          </div>
          <h1 className="text-3xl font-display font-bold mb-1">Meus Agentes</h1>
          <p className="text-muted">Crie, gerencie e implante sua equipe de inteligência artificial.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/app/marketplace')}
            className="px-5 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold hover:bg-bg transition-all flex items-center gap-2"
          >
            <Store className="w-4 h-4" /> Marketplace
          </button>
          <button
            onClick={() => setShowBuilder(true)}
            className="px-5 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Novo Agente
          </button>
        </div>
      </div>

      {/* Templates Section */}
      <section>
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Comece com um Template
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {templates.map((tpl) => {
            const Icon = templateIcon[tpl.id] || Bot
            return (
              <button
                key={tpl.id}
                onClick={() => handleCreateFromTemplate(tpl.id)}
                className="p-4 bg-surface border border-border rounded-2xl text-left hover:border-primary/30 hover:bg-primary/5 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center mb-3 group-hover:bg-primary/10 transition-all border border-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <p className="text-xs font-bold group-hover:text-primary transition-all mb-1">{tpl.title}</p>
                <p className="text-[9px] text-muted line-clamp-1">{tpl.desc}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* My Agents */}
      <section>
        <h2 className="font-bold text-lg mb-4">Meus Agentes</h2>
        {myAgents.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-[2.5rem] border border-border">
            <Bot className="w-16 h-16 text-muted/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Nenhum agente ainda</h3>
            <p className="text-sm text-muted mb-6">Crie seu primeiro agente de IA ou instale da loja.</p>
            <button onClick={() => setShowBuilder(true)} className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2">
              <Plus className="w-5 h-5" /> Criar Agente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {myAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onConfigure={(id) => navigate(`/app/agents/${id}`)}
                onToggle={handleToggleStatus}
                onDelete={handleDelete}
              />
            ))}
            <button
              onClick={() => setShowBuilder(true)}
              className="h-[260px] border-2 border-dashed border-border rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-muted hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-all">
                <Plus className="w-7 h-7" />
              </div>
              <span className="font-bold text-sm">Criar Agente do Zero</span>
            </button>
          </div>
        )}
      </section>

      {/* Store Agents (pre-installed) */}
      {storeAgents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              Agentes da Loja
            </h2>
            <button onClick={() => navigate('/app/marketplace')} className="text-xs text-primary font-bold hover:underline">
              Ver todos no Marketplace
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {storeAgents.slice(0, 3).map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onConfigure={(id) => navigate(`/app/agents/${id}`)}
                onToggle={handleToggleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Knowledge Base Card */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-[2.5rem] border border-primary/20 p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5">
          <Bot className="w-32 h-32" />
        </div>
        <div className="max-w-lg relative">
          <h3 className="font-bold text-xl text-primary mb-2">Base de Conhecimento</h3>
          <p className="text-sm text-muted mb-6">Conecte PDFs, URLs e documentos para treinar seus agentes automaticamente com RAG (Retrieval-Augmented Generation).</p>
          <button className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2">
            <Link className="w-4 h-4" /> Gerenciar Documentos
          </button>
        </div>
      </div>

      {/* Agent Builder Modal */}
      {showBuilder && (
        <AgentForm
          onClose={() => setShowBuilder(false)}
          onSave={handleCreateCustom}
        />
      )}
    </div>
  )
}
