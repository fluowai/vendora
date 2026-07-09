import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Bot,
  Briefcase,
  CheckCircle2,
  Clock,
  DollarSign,
  Heart,
  HelpCircle,
  Home,
  Layers,
  Link,
  Plus,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Store,
  Target,
  Users,
  Workflow,
  BookOpen,
} from "lucide-react"
import { api } from "@/src/lib/api"
import { useToast } from "@/src/components/Toast"
import { AgentCard } from "@/src/components/agents/AgentCard"
import { AgentForm } from "@/src/components/builder/AgentForm"

const templateIcon: Record<string, any> = {
  vendas: Briefcase,
  suporte: HelpCircle,
  retencao: Target,
  saude: Heart,
  juridico: Scale,
  educacao: BookOpen,
  imobiliario: Home,
  financeiro: DollarSign,
  rh: Users,
  logistica: Clock,
  ecommerce: ShoppingCart,
}

const templates = [
  { id: "vendas", title: "Vendedor SDR", desc: "Qualifica leads e agenda reunioes." },
  { id: "suporte", title: "Suporte Nivel 1", desc: "Resolve duvidas comuns e escala casos." },
  { id: "retencao", title: "Retencao", desc: "Recupera clientes e carrinhos." },
  { id: "saude", title: "Triagem Saude", desc: "Coleta dados e agenda consultas." },
  { id: "juridico", title: "Assistente Juridico", desc: "Orienta e organiza demandas." },
  { id: "educacao", title: "Tutor Virtual", desc: "Apoia alunos com duvidas." },
  { id: "imobiliario", title: "Corretor Virtual", desc: "Apresenta imoveis e agenda visitas." },
  { id: "financeiro", title: "Analista Financeiro", desc: "Simula credito e tira duvidas." },
]

const defaultHandoffRules = {
  autonomyMode: "supervised",
  businessGoal: "Qualificar clientes, tirar duvidas iniciais e encaminhar oportunidades para o fluxo correto.",
  whatsappInstanceIds: [],
  supportAgentIds: [],
  escalationKeywords: ["humano", "urgente", "cancelar"],
  fallbackInstructions: "Transferir para humano quando nao houver seguranca para responder.",
}

export default function Agents() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [agents, setAgents] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)

  useEffect(() => {
    Promise.all([
      api.getAgents(),
      api.getConnections().catch(() => ({ connections: [] })),
    ])
      .then(([agentRes, connectionRes]) => {
        setAgents(agentRes.agents)
        setConnections(
          connectionRes.connections.filter((item: any) =>
            item.channel?.provider === "whatsmeow" || item.channel?.provider === "whatsapp_cloud"
          )
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const myAgents = agents.filter((agent) => agent.authorId !== "system")
  const storeAgents = agents.filter((agent) => agent.isPublished && agent.authorId === "system")

  const connectionNameById = useMemo(
    () => new Map(connections.map((connection) => [connection.id, connection.name])),
    [connections]
  )

  const activeAgents = myAgents.filter((agent) => agent.status === "active")
  const autonomousAgents = myAgents.filter((agent) => agent.handoffRules?.autonomyMode === "autonomous")
  const linkedWhatsAppIds = new Set(myAgents.flatMap((agent) => agent.handoffRules?.whatsappInstanceIds || []))

  const getAgentConnections = (agent: any) => {
    const ids = agent.handoffRules?.whatsappInstanceIds || []
    return ids.map((id: string) => connectionNameById.get(id) || id)
  }

  const getSupportAgents = (agent: any) => {
    const ids = agent.handoffRules?.supportAgentIds || []
    return ids
      .map((id: string) => agents.find((item) => item.id === id)?.name)
      .filter(Boolean)
  }

  const handleCreateFromTemplate = async (segment: string) => {
    try {
      const res = await api.createAgent({
        name: `Novo ${segment.charAt(0).toUpperCase() + segment.slice(1)}`,
        description: "Agente criado a partir de template.",
        segment,
        status: "draft",
        llmConfig: {
          provider: "groq",
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          systemPrompt: "",
        },
        channels: ["web"],
        handoffRules: defaultHandoffRules,
        isPublished: false,
        authorId: "user",
        authorName: "Usuario",
        tags: [segment],
      })
      setAgents((prev) => [...prev, res.agent])
      navigate(`/app/agents/${res.agent.id}`)
    } catch (e: any) {
      toast(`Erro: ${e.message}`, "error")
    }
  }

  const handleCreateCustom = async (data: any) => {
    try {
      const res = await api.createAgent({
        ...data,
        isPublished: false,
        installs: 0,
        rating: 0,
        authorId: "user",
        authorName: "Usuario",
      })
      setAgents((prev) => [...prev, res.agent])
      setShowBuilder(false)
      navigate(`/app/agents/${res.agent.id}`)
    } catch (e: any) {
      toast(`Erro: ${e.message}`, "error")
    }
  }

  const handleToggleStatus = (id: string) => {
    const agent = agents.find((item) => item.id === id)
    if (!agent) return
    const nextStatus = agent.status === "active" ? "paused" : "active"
    setAgents((prev) => prev.map((item) => item.id === id ? { ...item, status: nextStatus } : item))
    api.updateAgent(id, { status: nextStatus }).catch((e: any) => toast(`Erro: ${e.message}`, "error"))
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este agente?")) return
    await api.deleteAgent(id)
    setAgents((prev) => prev.filter((agent) => agent.id !== id))
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Fabrica de Agentes</span>
          </div>
          <h1 className="text-3xl font-display font-bold mb-1">Central de Agentes Autonomos</h1>
          <p className="text-muted max-w-3xl">
            Monte prompts, equipes multiagente e vincule numeros de WhatsApp para atendimento sem depender do humano.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/app/marketplace")}
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

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-5">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Workflow className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Fluxo de montagem</h2>
              <p className="text-xs text-muted">Configure o agente, ligue especialistas e publique em WhatsApp.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Bot, title: "Prompt e objetivo", desc: "Persona, regras, modelo e nivel de criatividade." },
              { icon: Users, title: "Multiagente", desc: "Especialistas de apoio para vendas, suporte ou triagem." },
              { icon: Smartphone, title: "WhatsApp", desc: "Instancias vinculadas para atendimento autonomo." },
            ].map((step) => (
              <div key={step.title} className="p-4 bg-bg border border-border rounded-xl">
                <step.icon className="w-5 h-5 text-primary mb-3" />
                <p className="text-xs font-bold mb-1">{step.title}</p>
                <p className="text-[10px] text-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Agentes ativos", value: activeAgents.length, icon: CheckCircle2 },
            { label: "Autonomos", value: autonomousAgents.length, icon: ShieldCheck },
            { label: "WhatsApps", value: connections.length, icon: Smartphone },
            { label: "Vinculados", value: linkedWhatsAppIds.size, icon: Link },
          ].map((stat) => (
            <div key={stat.label} className="bg-surface border border-border rounded-2xl p-4">
              <stat.icon className="w-4 h-4 text-primary mb-3" />
              <p className="text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Comece com um template
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

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Agentes em operacao</h2>
          {loading && <span className="text-xs text-muted">Carregando...</span>}
        </div>

        {myAgents.length === 0 ? (
          <div className="text-center py-16 bg-surface rounded-2xl border border-border">
            <Bot className="w-16 h-16 text-muted/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Nenhum agente ainda</h3>
            <p className="text-sm text-muted mb-6">Crie seu primeiro agente e vincule um WhatsApp para atendimento autonomo.</p>
            <button onClick={() => setShowBuilder(true)} className="px-6 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2">
              <Plus className="w-5 h-5" /> Criar Agente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {myAgents.map((agent) => {
              const linkedConnections = getAgentConnections(agent)
              const supportAgents = getSupportAgents(agent)
              return (
                <div key={agent.id} className="space-y-3">
                  <AgentCard
                    agent={agent}
                    onConfigure={(agentId) => navigate(`/app/agents/${agentId}`)}
                    onToggle={handleToggleStatus}
                    onDelete={handleDelete}
                  />
                  <div className="bg-surface border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        Autonomia
                      </span>
                      <span className="text-[10px] font-bold text-primary uppercase">
                        {agent.handoffRules?.autonomyMode || "supervised"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted">
                      <Smartphone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{linkedConnections.length ? linkedConnections.join(", ") : "Nenhum WhatsApp vinculado"}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted">
                      <Users className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{supportAgents.length ? supportAgents.join(", ") : "Sem agentes de apoio"}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <button
              onClick={() => setShowBuilder(true)}
              className="min-h-[340px] border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-4 text-muted hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-all">
                <Plus className="w-7 h-7" />
              </div>
              <span className="font-bold text-sm">Criar Agente do Zero</span>
            </button>
          </div>
        )}
      </section>

      {storeAgents.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Store className="w-4 h-4 text-primary" />
              Agentes da loja
            </h2>
            <button onClick={() => navigate("/app/marketplace")} className="text-xs text-primary font-bold hover:underline">
              Ver todos no Marketplace
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {storeAgents.slice(0, 3).map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onConfigure={(agentId) => navigate(`/app/agents/${agentId}`)}
                onToggle={handleToggleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      <div className="bg-surface rounded-2xl border border-border p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5">
          <Bot className="w-32 h-32" />
        </div>
        <div className="max-w-lg relative">
          <h3 className="font-bold text-xl text-primary mb-2">Base de Conhecimento</h3>
          <p className="text-sm text-muted mb-6">
            Conecte PDFs, URLs e documentos para dar contexto aos agentes antes deles atenderem clientes.
          </p>
          <button className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2">
            <Link className="w-4 h-4" /> Gerenciar Documentos
          </button>
        </div>
      </div>

      {showBuilder && (
        <AgentForm
          agents={agents}
          onClose={() => setShowBuilder(false)}
          onSave={handleCreateCustom}
        />
      )}
    </div>
  )
}
