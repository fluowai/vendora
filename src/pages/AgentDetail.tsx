import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  BarChart,
  Bot,
  Brain,
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

export default function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<any>(null)
  const [agents, setAgents] = useState<any[]>([])
  const [connections, setConnections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "chat" | "analytics" | "knowledge" | "integrations">("overview")
  const [chatMessage, setChatMessage] = useState("")
  const [chatResponse, setChatResponse] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const [uploadingKnowledge, setUploadingKnowledge] = useState(false)
  const [knowledgeMessage, setKnowledgeMessage] = useState("")
  const knowledgeInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!id) return
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

  const supportAgentNames = (agent.handoffRules?.supportAgentIds || [])
    .map((agentId: string) => agents.find((item) => item.id === agentId)?.name)
    .filter(Boolean)
  const whatsappNames = (agent.handoffRules?.whatsappInstanceIds || [])
    .map((instanceId: string) => connections.find((item) => item.id === instanceId)?.name || instanceId)

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
      setShowConfig(false)
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message}`)
    }
  }

  const handleToggleStatus = async () => {
    const nextStatus = agent.status === "active" ? "paused" : "active"
    const res = await api.updateAgent(agent.id, { status: nextStatus })
    setAgent(res.agent)
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

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/app/agents")} className="p-2 rounded-xl hover:bg-bg transition-all text-muted">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-display font-bold">{agent.name}</h1>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                agent.status === "active" ? "bg-primary/10 text-primary border border-primary/20" :
                  agent.status === "paused" ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" :
                    "bg-muted/10 text-muted border border-muted/20"
              )}>
                {agent.status}
              </span>
            </div>
            <p className="text-xs text-muted">{agent.segment} | {agent.llmConfig?.provider} | {agent.llmConfig?.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          { label: "Conversas", value: agent.installs?.toLocaleString() || "0", icon: MessageSquare },
          { label: "Autonomia", value: agent.handoffRules?.autonomyMode || "supervised", icon: ShieldCheck },
          { label: "WhatsApp", value: whatsappNames.length, icon: Smartphone },
          { label: "Apoios", value: supportAgentNames.length, icon: Users },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-display font-bold truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-surface rounded-2xl p-1 border border-border w-fit max-w-full overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap",
                activeTab === tab.id ? "bg-primary text-white" : "text-muted hover:text-text"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="bg-surface rounded-2xl border border-border p-8">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-2">Descricao</h3>
              <p className="text-sm text-muted leading-relaxed">{agent.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Modelo</h4>
                <div className="space-y-3">
                  {[
                    ["Provider", agent.llmConfig?.provider],
                    ["Modelo", agent.llmConfig?.model],
                    ["Temperature", agent.llmConfig?.temperature ?? 0.7],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="flex justify-between py-2 border-b border-border">
                      <span className="text-xs text-muted">{label}</span>
                      <span className="text-xs font-bold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Canais ativos</h4>
                <div className="flex flex-wrap gap-2">
                  {agent.channels?.map((ch: string) => (
                    <span key={ch} className="px-3 py-1.5 bg-bg border border-border rounded-lg text-[10px] font-bold">{ch}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-bg border border-border rounded-2xl">
                <ShieldCheck className="w-4 h-4 text-primary mb-2" />
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Autonomia</h4>
                <p className="text-sm font-bold">{agent.handoffRules?.autonomyMode || "supervised"}</p>
                <p className="text-xs text-muted mt-2">{agent.handoffRules?.businessGoal || "Objetivo operacional nao configurado."}</p>
              </div>
              <div className="p-4 bg-bg border border-border rounded-2xl">
                <Smartphone className="w-4 h-4 text-primary mb-2" />
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">WhatsApp</h4>
                <p className="text-sm font-bold">{whatsappNames.length} vinculo(s)</p>
                <p className="text-xs text-muted mt-2">{whatsappNames.length ? whatsappNames.join(", ") : "Nenhum numero vinculado."}</p>
              </div>
              <div className="p-4 bg-bg border border-border rounded-2xl">
                <Users className="w-4 h-4 text-primary mb-2" />
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Multiagente</h4>
                <p className="text-sm font-bold">{supportAgentNames.length} apoio(s)</p>
                <p className="text-xs text-muted mt-2">{supportAgentNames.length ? supportAgentNames.join(", ") : "Sem especialistas de apoio."}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">System Prompt</h4>
              <pre className="bg-bg border border-border rounded-2xl p-4 text-xs font-mono text-muted whitespace-pre-wrap">{agent.llmConfig?.systemPrompt}</pre>
            </div>
          </div>
        )}

        {activeTab === "chat" && (
          <div className="space-y-4">
            <h3 className="font-bold mb-4">Testar agente</h3>
            <div className="bg-bg rounded-2xl border border-border p-6 min-h-[200px] mb-4">
              {chatResponse ? (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-1">{agent.name}</p>
                    <p className="text-sm text-muted whitespace-pre-wrap">{chatResponse}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted/50 text-center py-8">Envie uma mensagem para testar o agente</p>
              )}
            </div>
            <div className="flex gap-3">
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
            <p className="text-sm text-muted mb-6">Faca upload de PDFs, textos ou URLs para dar contexto especifico ao agente.</p>
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
              <Upload className="w-4 h-4" /> {uploadingKnowledge ? "Enviando..." : "Upload de Documentos"}
            </button>
            {knowledgeMessage && <p className="mt-4 text-xs font-bold text-muted">{knowledgeMessage}</p>}
            <p className="mt-3 text-[11px] text-muted">Arquivos PDF precisam ser convertidos para texto antes do envio nesta versao.</p>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg">Integracoes</h3>
                <p className="text-xs text-muted mt-1">Vincule numeros de WhatsApp e canais onde este agente atende automaticamente.</p>
              </div>
              <button onClick={() => setShowConfig(true)} className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold hover:bg-primary/90 transition-all">
                Configurar vinculos
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-bg border border-border rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Smartphone className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">WhatsApp autonomo</p>
                    <p className="text-[10px] text-muted">Numeros que usam este agente para responder clientes.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {whatsappNames.length ? whatsappNames.map((name: string) => (
                    <div key={name} className="px-3 py-2 bg-surface border border-border rounded-xl text-xs font-bold">
                      {name}
                    </div>
                  )) : (
                    <p className="text-xs text-muted">Nenhum numero vinculado.</p>
                  )}
                </div>
              </div>
              <div className="p-5 bg-bg border border-border rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold">Equipe multiagente</p>
                    <p className="text-[10px] text-muted">Especialistas chamados quando o atendimento precisa de apoio.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {supportAgentNames.length ? supportAgentNames.map((name: string) => (
                    <div key={name} className="px-3 py-2 bg-surface border border-border rounded-xl text-xs font-bold">
                      {name}
                    </div>
                  )) : (
                    <p className="text-xs text-muted">Nenhum agente de apoio configurado.</p>
                  )}
                </div>
              </div>
              {[
                { icon: Globe, name: "Web Widget", desc: "Chat no seu site", status: "disponivel" },
                { icon: Code, name: "API Publica", desc: "Endpoint REST para integracao", status: "disponivel" },
              ].map((integration) => (
                <div key={integration.name} className="p-5 bg-bg border border-border rounded-2xl flex items-center justify-between">
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
