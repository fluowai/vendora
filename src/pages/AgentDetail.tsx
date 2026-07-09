import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart,
  Bot,
  Brain,
  CheckCircle2,
  Code,
  FileText,
  Globe,
  Link,
  MessageSquare,
  Pause,
  Play,
  Settings2,
  ShieldCheck,
  Smartphone,
  Upload,
  Users,
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/lib/api"
import { AgentForm } from "@/src/components/builder/AgentForm"

type TabId = "overview" | "chat" | "analytics" | "knowledge" | "integrations"

function ruleArray(agent: any, key: string): string[] {
  const value = agent?.handoffRules?.[key]
  return Array.isArray(value) ? value : []
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
    provider: connection.channel?.provider || "whatsapp",
  }
}

function agentUsesConnection(agent: any, connectionId: string) {
  return ruleArray(agent, "whatsappInstanceIds").includes(connectionId)
}

export default function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<any>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [chatMessage, setChatMessage] = useState("")
  const [chatResponse, setChatResponse] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false)
  const [knowledgeMessage, setKnowledgeMessage] = useState("")
  const knowledgeInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.getAgent(id),
      api.getAgents().catch(() => ({ agents: [] })),
      api.getConnections().catch(() => ({ connections: [] })),
    ])
      .then(([agentRes, agentsRes, connectionsRes]) => {
        setAgent(agentRes.agent)
        setAgents(agentsRes.agents)
        setConnections(
          connectionsRes.connections.filter((item: any) =>
            item.channel?.provider === "whatsmeow" || item.channel?.provider === "whatsapp_cloud"
          )
        )
      })
      .finally(() => setLoading(false))
  }, [id])

  const supportAgentNames = useMemo(() => (
    ruleArray(agent, "supportAgentIds")
      .map((agentId) => agents.find((item) => item.id === agentId)?.name)
      .filter(Boolean)
  ), [agent, agents])

  const linkedWhatsappConnections = useMemo(() => (
    ruleArray(agent, "whatsappInstanceIds")
      .map((instanceId) => connections.find((item) => item.id === instanceId))
      .filter(Boolean)
  ), [agent, connections])

  const whatsappEnabled = agent?.channels?.includes("whatsapp")
  const whatsappNotLinked = whatsappEnabled && linkedWhatsappConnections.length === 0

  const connectionOwnerNames = (connectionId: string) => (
    agents
      .filter((item) => agentUsesConnection(item, connectionId))
      .map((item) => item.id === agent?.id ? `${item.name} (este agente)` : item.name)
  )

  const handleChat = async () => {
    if (!chatMessage.trim()) return
    setChatLoading(true)
    try {
      const res = await api.chatWithAgent(agent.id, chatMessage)
      setChatResponse(res.response)
    } catch (e: any) {
      setChatResponse(`Erro: ${e.message}`)
    }
    setChatLoading(false)
  }

  const handleSaveConfig = async (data: any) => {
    try {
      const res = await api.updateAgent(agent.id, data)
      setAgent(res.agent)
      setAgents((items) => items.some((item) => item.id === res.agent.id)
        ? items.map((item) => item.id === res.agent.id ? res.agent : item)
        : [res.agent, ...items])
      setShowConfig(false)
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message}`)
    }
  }

  const handleToggleStatus = async () => {
    const nextStatus = agent.status === "active" ? "paused" : "active"
    const res = await api.updateAgent(agent.id, { status: nextStatus })
    setAgent(res.agent)
    setAgents((items) => items.map((item) => item.id === res.agent.id ? res.agent : item))
  }

  const uploadKnowledgeDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setUploadingKnowledge(true)
    setKnowledgeMessage("")
    try {
      const content = await file.text()
      const type = file.name.toLowerCase().endsWith(".csv") ? "csv" : "txt"
      let knowledgeBaseId = agent.knowledgeBaseId
      if (!knowledgeBaseId) {
        const created = await api.createKnowledgeBase(`Base - ${agent.name}`)
        knowledgeBaseId = created.knowledgeBase.id
        const updated = await api.updateAgent(agent.id, { knowledgeBaseId })
        setAgent(updated.agent)
      }
      await api.addDocument(knowledgeBaseId, { name: file.name, type, content })
      setKnowledgeMessage(`${file.name} enviado com sucesso.`)
    } catch (e: any) {
      setKnowledgeMessage(e.message || "Erro ao enviar documento")
    } finally {
      setUploadingKnowledge(false)
    }
  }

  const tabs = [
    { id: "overview", label: "Visao Geral", icon: BarChart },
    { id: "chat", label: "Testar Chat", icon: MessageSquare },
    { id: "analytics", label: "Analytics", icon: Brain },
    { id: "knowledge", label: "Base de Conhecimento", icon: FileText },
    { id: "integrations", label: "Integracoes", icon: Link },
  ] as const

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="text-center py-20">
        <Bot className="w-16 h-16 text-muted/30 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Agente nao encontrado</h2>
        <button onClick={() => navigate("/app/agents")} className="text-primary font-bold text-sm">Voltar</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate("/app/agents")} className="p-2 rounded-xl hover:bg-bg transition-all text-muted mt-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-display font-bold truncate">{agent.name}</h1>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                agent.status === "active" ? "bg-primary/10 text-primary border-primary/20" :
                  agent.status === "paused" ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" :
                    "bg-muted/10 text-muted border-muted/20"
              )}>
                {agent.status}
              </span>
              {whatsappNotLinked && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold uppercase tracking-wider">
                  <AlertTriangle className="w-3 h-3" /> WhatsApp sem vinculo
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1">{agent.segment} | {agent.llmConfig?.provider} | {agent.llmConfig?.model}</p>
            <p className="text-sm text-muted mt-3 max-w-3xl leading-relaxed">{agent.description || "Sem descricao configurada."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setShowConfig(true)} className="px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold hover:bg-bg transition-all flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Configurar
          </button>
          <button onClick={handleToggleStatus} className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2">
            {agent.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {agent.status === "active" ? "Pausar" : "Ativar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Conversas", value: agent.installs?.toLocaleString() || "0", icon: MessageSquare, hint: "historico" },
          { label: "Autonomia", value: agent.handoffRules?.autonomyMode || "supervised", icon: ShieldCheck, hint: "modo" },
          { label: "WhatsApp", value: linkedWhatsappConnections.length, icon: Smartphone, hint: "vinculos" },
          { label: "Apoios", value: supportAgentNames.length, icon: Users, hint: "multiagente" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-display font-bold truncate">{stat.value}</p>
            <p className="text-[10px] text-muted mt-1">{stat.hint}</p>
          </div>
        ))}
      </div>

      {whatsappNotLinked && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 flex items-start gap-3 text-amber-900">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">Este agente tem WhatsApp nos canais, mas nenhum numero vinculado.</p>
            <p className="text-xs mt-1 leading-relaxed">Com a correcao de seguranca, essa instancia nao deve responder automaticamente ate voce ligar um numero em Configurar &gt; Vinculos.</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-surface rounded-xl p-1 border border-border w-fit max-w-full overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === tab.id ? "bg-primary text-white" : "text-muted hover:text-text"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="bg-surface rounded-xl border border-border p-5 lg:p-7">
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-lg mb-3">System Prompt</h3>
                <pre className="min-h-[280px] max-h-[520px] overflow-auto bg-slate-950 text-slate-100 border border-slate-800 rounded-xl p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                  {agent.llmConfig?.systemPrompt || "Nenhum prompt configurado."}
                </pre>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-bg border border-border rounded-xl">
                  <Activity className="w-4 h-4 text-primary mb-2" />
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Modelo</h4>
                  <p className="text-sm font-bold">{agent.llmConfig?.provider}</p>
                  <p className="text-xs text-muted mt-1">{agent.llmConfig?.model}</p>
                </div>
                <div className="p-4 bg-bg border border-border rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-primary mb-2" />
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Objetivo</h4>
                  <p className="text-xs text-muted leading-relaxed">{agent.handoffRules?.businessGoal || "Objetivo operacional nao configurado."}</p>
                </div>
                <div className="p-4 bg-bg border border-border rounded-xl">
                  <Globe className="w-4 h-4 text-primary mb-2" />
                  <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Canais</h4>
                  <div className="flex flex-wrap gap-2">
                    {agent.channels?.map((ch: string) => (
                      <span key={ch} className="px-2.5 py-1 bg-surface border border-border rounded-lg text-[10px] font-bold">{ch}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border border-border bg-bg p-5">
                <h3 className="font-bold mb-1">Mapa de vinculos</h3>
                <p className="text-xs text-muted mb-4">Veja exatamente qual agente responde em cada numero.</p>
                <div className="space-y-3">
                  {connections.length === 0 ? (
                    <p className="text-xs text-muted">Nenhuma instancia WhatsApp cadastrada.</p>
                  ) : connections.map((connection) => {
                    const view = connectionIdentity(connection)
                    const owners = connectionOwnerNames(connection.id)
                    const current = agentUsesConnection(agent, connection.id)
                    return (
                      <div key={connection.id} className={cn(
                        "rounded-xl border p-3",
                        current ? "border-primary/30 bg-primary/10" : "border-border bg-surface"
                      )}>
                        <div className="flex items-start gap-3">
                          <span className={cn("mt-1 h-2.5 w-2.5 rounded-full shrink-0", view.connected ? "bg-primary" : "bg-amber-400")} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate">{view.label}</p>
                            <p className="text-[11px] text-muted truncate">{view.phone || view.provider}</p>
                            <p className="text-[11px] mt-2 font-semibold text-muted">
                              {owners.length ? owners.join(", ") : "Sem agente vinculado"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </aside>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="space-y-4">
            <h3 className="font-bold mb-4">Testar agente</h3>
            <div className="bg-bg rounded-xl border border-border p-6 min-h-[220px] mb-4">
              {chatResponse ? (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-1">{agent.name}</p>
                    <p className="text-sm text-muted whitespace-pre-wrap leading-relaxed">{chatResponse}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted/60 text-center py-10">Envie uma mensagem para testar o agente</p>
              )}
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChat()}
                placeholder="Digite uma mensagem de teste..."
                className="flex-1 bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all"
              />
              <button
                onClick={handleChat}
                disabled={chatLoading || !chatMessage.trim()}
                className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {chatLoading ? "Processando..." : "Enviar"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-muted/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Analytics em breve</h3>
            <p className="text-sm text-muted">Metricas de desempenho, satisfacao e conversao serao exibidas aqui.</p>
          </div>
        )}

        {activeTab === "knowledge" && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Base de Conhecimento</h3>
            <p className="text-sm text-muted mb-6">Envie textos, markdown ou CSV para dar contexto especifico ao agente.</p>
            <input
              ref={knowledgeInputRef}
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
              className="hidden"
              onChange={uploadKnowledgeDocument}
            />
            <button
              onClick={() => knowledgeInputRef.current?.click()}
              disabled={uploadingKnowledge}
              className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              <Upload className="w-4 h-4" /> {uploadingKnowledge ? "Enviando..." : "Upload de documentos"}
            </button>
            {knowledgeMessage && <p className="mt-4 text-xs font-bold text-muted">{knowledgeMessage}</p>}
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">Integracoes</h3>
                <p className="text-xs text-muted mt-1">Controle quais numeros e canais podem acionar este agente automaticamente.</p>
              </div>
              <button onClick={() => setShowConfig(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold hover:bg-primary/90 transition-all w-fit">
                Configurar vinculos
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {connections.map((connection) => {
                const view = connectionIdentity(connection)
                const owners = connectionOwnerNames(connection.id)
                const current = agentUsesConnection(agent, connection.id)
                return (
                  <div key={connection.id} className={cn(
                    "p-5 border rounded-xl",
                    current ? "bg-primary/10 border-primary/30" : "bg-bg border-border"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <Smartphone className={cn("w-5 h-5 mt-1 shrink-0", current ? "text-primary" : "text-muted")} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{view.label}</p>
                          <p className="text-xs text-muted truncate">{view.phone || connection.name}</p>
                          <p className="text-[11px] text-muted mt-2">
                            {owners.length ? `Agente ligado: ${owners.join(", ")}` : "Nenhum agente ligado"}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase",
                        current ? "bg-primary text-white" : "bg-surface border border-border text-muted"
                      )}>
                        {current ? <CheckCircle2 className="w-3 h-3" /> : null}
                        {current ? "este agente" : view.connected ? "conectado" : "pendente"}
                      </span>
                    </div>
                  </div>
                )
              })}

              {connections.length === 0 && (
                <div className="p-6 bg-bg border border-border rounded-xl text-sm text-muted">
                  Nenhuma instancia WhatsApp cadastrada.
                </div>
              )}

              {[
                { icon: Globe, name: "Web Widget", desc: "Chat no seu site", status: "disponivel" },
                { icon: Code, name: "API Publica", desc: "Endpoint REST para integracao", status: "disponivel" },
              ].map((integration) => (
                <div key={integration.name} className="p-5 bg-bg border border-border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <integration.icon className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-bold">{integration.name}</p>
                      <p className="text-[10px] text-muted">{integration.desc}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[10px] font-bold uppercase">
                    {integration.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showConfig && (
        <AgentForm
          initial={agent}
          agents={agents}
          onClose={() => setShowConfig(false)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  )
}
