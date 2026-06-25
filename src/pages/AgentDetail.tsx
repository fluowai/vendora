import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Bot, ArrowLeft, Play, Pause, Settings2, Trash2,
  MessageSquare, BarChart, Brain, Link, Upload,
  FileText, Star, Download, Share2, Code, Globe
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/lib/api"
import { AgentForm } from "@/src/components/builder/AgentForm"

export default function AgentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'analytics' | 'knowledge' | 'integrations'>('overview')
  const [chatMessage, setChatMessage] = useState('')
  const [chatResponse, setChatResponse] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    if (!id) return
    api.getAgent(id).then((res) => {
      setAgent(res.agent)
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!agent) return (
    <div className="text-center py-20">
      <Bot className="w-16 h-16 text-muted/30 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Agente não encontrado</h2>
      <button onClick={() => navigate('/app/agents')} className="text-primary font-bold text-sm">Voltar</button>
    </div>
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
      setShowConfig(false)
    } catch (e: any) {
      alert(`Erro ao salvar: ${e.message}`)
    }
  }

  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart },
    { id: 'chat', label: 'Testar Chat', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics', icon: Brain },
    { id: 'knowledge', label: 'Base de Conhecimento', icon: FileText },
    { id: 'integrations', label: 'Integrações', icon: Link },
  ] as const

  return (
    <div className="space-y-6 pb-10">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/app/agents')} className="p-2 rounded-xl hover:bg-bg transition-all text-muted">
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
                agent.status === 'active' ? 'bg-primary/10 text-primary border border-primary/20' :
                agent.status === 'paused' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' :
                'bg-muted/10 text-muted border border-muted/20'
              )}>
                {agent.status}
              </span>
            </div>
            <p className="text-xs text-muted">{agent.segment} · {agent.llmConfig?.provider} · {agent.llmConfig?.model}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowConfig(true)} className="px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold hover:bg-bg transition-all flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Configurar
          </button>
          <button className="px-4 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2">
            {agent.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {agent.status === 'active' ? 'Pausar' : 'Ativar'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Conversas', value: agent.installs?.toLocaleString() || '0', icon: MessageSquare },
          { label: 'Avaliação', value: `${agent.rating || 0}`, icon: Star },
          { label: 'Canais', value: agent.channels?.length || 0, icon: Globe },
          { label: 'Downloads', value: agent.installs?.toLocaleString() || '0', icon: Download },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-display font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-2xl p-1 border border-border w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                activeTab === tab.id ? 'bg-primary text-white' : 'text-muted hover:text-text'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-surface rounded-[2.5rem] border border-border p-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-lg mb-2">Descrição</h3>
              <p className="text-sm text-muted leading-relaxed">{agent.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Configuração do Modelo</h4>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-xs text-muted">Provider</span>
                    <span className="text-xs font-bold">{agent.llmConfig?.provider}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-xs text-muted">Modelo</span>
                    <span className="text-xs font-bold">{agent.llmConfig?.model}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-xs text-muted">Temperature</span>
                    <span className="text-xs font-bold">{agent.llmConfig?.temperature ?? 0.7}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Canais Ativos</h4>
                <div className="flex flex-wrap gap-2">
                  {agent.channels?.map((ch: string) => (
                    <span key={ch} className="px-3 py-1.5 bg-bg border border-border rounded-lg text-[10px] font-bold">{ch}</span>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">System Prompt</h4>
              <pre className="bg-bg border border-border rounded-2xl p-4 text-xs font-mono text-muted whitespace-pre-wrap">{agent.llmConfig?.systemPrompt}</pre>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="space-y-4">
            <h3 className="font-bold mb-4">Testar Agente</h3>
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
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Digite uma mensagem de teste..."
                className="flex-1 bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none focus:border-primary/50 transition-all"
              />
              <button
                onClick={handleChat}
                disabled={chatLoading || !chatMessage.trim()}
                className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {chatLoading ? 'Processando...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-muted/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Analytics em Breve</h3>
            <p className="text-sm text-muted">Métricas detalhadas de desempenho, satisfação e conversão estarão disponíveis em breve.</p>
          </div>
        )}

        {activeTab === 'knowledge' && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-muted/30 mx-auto mb-4" />
            <h3 className="font-bold text-lg mb-2">Base de Conhecimento</h3>
            <p className="text-sm text-muted mb-6">Faça upload de PDFs, textos ou URLs para treinar seu agente com informações específicas.</p>
            <button className="px-6 py-3 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2 mx-auto">
              <Upload className="w-4 h-4" /> Upload de Documentos
            </button>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg mb-4">Integrações</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: MessageSquare, name: 'WhatsApp API', desc: 'Conecte seu número oficial', status: 'disponivel' },
                { icon: MessageSquare, name: 'Instagram Direct', desc: 'Responda mensagens do Instagram', status: 'disponivel' },
                { icon: Globe, name: 'Web Widget', desc: 'Chat no seu site', status: 'disponivel' },
                { icon: Code, name: 'API Pública', desc: 'Endpoint REST para integração', status: 'disponivel' },
              ].map((int) => (
                <div key={int.name} className="p-5 bg-bg border border-border rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <int.icon className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-bold">{int.name}</p>
                      <p className="text-[10px] text-muted">{int.desc}</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-bold hover:bg-primary/90 transition-all">
                    Conectar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Config Modal */}
      {showConfig && (
        <AgentForm
          initial={agent}
          onClose={() => setShowConfig(false)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  )
}
