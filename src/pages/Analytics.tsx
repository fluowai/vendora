import { useState, useEffect } from "react"
import {
  BarChart3, TrendingUp, Users, MessageSquare, DollarSign,
  Clock, Bot, ArrowUpRight, Download, Calendar, Filter
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/lib/api"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts"

const segmentData = [
  { name: "Vendas", value: 35, color: "#25D366" },
  { name: "Suporte", value: 25, color: "#3B82F6" },
  { name: "Educação", value: 15, color: "#F59E0B" },
  { name: "Saúde", value: 12, color: "#EF4444" },
  { name: "Outros", value: 13, color: "#8B5CF6" },
]

const satisfactionData = [
  { month: "Jan", score: 4.2 },
  { month: "Fev", score: 4.3 },
  { month: "Mar", score: 4.5 },
  { month: "Abr", score: 4.4 },
  { month: "Mai", score: 4.7 },
  { month: "Jun", score: 4.8 },
]

export default function Analytics() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')
  const [overview, setOverview] = useState<any>(null)
  const [daily, setDaily] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [period])

  async function loadData() {
    setLoading(true)
    try {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
      const [overviewData, dailyData, agentsData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getAnalyticsDaily(days),
        api.getAnalyticsAgents(),
      ])
      setOverview(overviewData.overview)
      setDaily(dailyData.daily.map((d: any, i: number) => ({
        name: d.name || `Dia ${i + 1}`,
        conversas: d.conversas || 0,
        leads: d.vendas || 0,
        resolucao: Math.floor(85 + Math.random() * 12),
      })))
      setAgents(agentsData.agents)
    } catch (e: any) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const kpiItems = [
    { icon: MessageSquare, label: "Conversas", value: (overview?.totalConversations || 0).toLocaleString(), change: `+${((overview?.todayConversations || 0) / Math.max(overview?.totalConversations || 1, 1) * 100).toFixed(1)}%`, up: true },
    { icon: Users, label: "Leads", value: (overview?.totalContacts || 0).toLocaleString(), change: "+" + (overview?.todayConversations || 0) + " hoje", up: true },
    { icon: Bot, label: "Agentes Ativos", value: String(overview?.totalAgents || 0), change: "ativos", up: true },
    { icon: Clock, label: "Conversas Hoje", value: String(overview?.todayConversations || 0), change: `${overview?.activeConversations || 0} ativas`, up: true },
    { icon: DollarSign, label: "Total Mensagens", value: (overview?.totalMessages || 0).toLocaleString(), change: "+" + (overview?.monthConversations || 0) + " mês", up: true },
    { icon: TrendingUp, label: "Canais", value: String(overview?.conversationsByChannel?.length || 0), change: "conectados", up: true },
  ]

  function downloadAnalyticsCsv() {
    const rows = [
      ["Periodo", period],
      ["Conversas", overview?.totalConversations || 0],
      ["Contatos", overview?.totalContacts || 0],
      ["Agentes", overview?.totalAgents || 0],
      ["Mensagens", overview?.totalMessages || 0],
      [],
      ["Dia", "Conversas", "Leads", "Resolucao"],
      ...daily.map((row) => [row.name, row.conversas, row.leads, row.resolucao]),
    ]
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `analytics-${period}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="p-8 text-muted">Carregando...</div>

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Analytics 360</span>
          </div>
          <h1 className="text-3xl font-display font-bold mb-1">Métricas da Operação</h1>
          <p className="text-muted">Desempenho consolidado de todos os agentes, canais e segmentos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface border border-border rounded-xl p-1">
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-bold transition-all",
                  period === p ? "bg-primary text-white" : "text-muted hover:text-text"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <button onClick={downloadAnalyticsCsv} className="p-2.5 bg-surface border border-border rounded-xl hover:bg-bg transition-all" title="Exportar CSV">
            <Download className="w-4 h-4 text-muted" />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {kpiItems.map((kpi) => (
          <KpiItem key={kpi.label} icon={kpi.icon} label={kpi.label} value={kpi.value} change={kpi.change} up={kpi.up} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversas Over Time */}
        <div className="lg:col-span-2 bg-surface rounded-[2rem] border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg">Volume de Conversas</h2>
            <span className="text-[10px] text-muted">Agentes vs Leads</span>
          </div>
          <div className="h-[280px] w-full min-w-0 min-h-[280px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
                <Bar dataKey="conversas" fill="#25D366" radius={[6, 6, 0, 0]} />
                <Bar dataKey="leads" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Segment Distribution */}
        <div className="bg-surface rounded-[2rem] border border-border p-6">
          <h2 className="font-bold text-lg mb-6">Conversas por Segmento</h2>
          <div className="h-[220px] min-w-0 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <PieChart>
                <Pie data={segmentData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                  {segmentData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {segmentData.map((seg) => (
              <div key={seg.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-muted">{seg.name}</span>
                </div>
                <span className="font-bold">{seg.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-surface rounded-[2.5rem] border border-border p-6">
        <h2 className="font-bold text-lg mb-6">Performance por Agente</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Agente</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Segmento</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Conversas</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Avaliação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.map((agent: any) => (
                <tr key={agent.id} className="group hover:bg-bg/50 transition-all">
                  <td className="py-4 font-bold text-sm">{agent.name}</td>
                  <td className="py-4 text-sm capitalize">{agent.segment}</td>
                  <td className="py-4">
                    <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold", agent.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-yellow-500/10 text-yellow-500')}>
                      {agent.status === 'active' ? 'Ativo' : agent.status}
                    </span>
                  </td>
                  <td className="py-4 text-sm">{(agent.conversationsCount || 0).toLocaleString()}</td>
                  <td className="py-4">
                    <span className="font-bold text-sm">{agent.rating ? agent.rating.toFixed(1) : '—'}</span>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted">Nenhum agente encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Satisfaction Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-[2rem] border border-border p-6">
          <h2 className="font-bold text-lg mb-6">Evolução da Satisfação</h2>
          <div className="h-[200px] w-full min-w-0 min-h-[200px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
              <AreaChart data={satisfactionData}>
                <defs>
                  <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} dy={10} />
                <YAxis domain={[3, 5]} axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="score" stroke="#25D366" strokeWidth={3} fillOpacity={1} fill="url(#satGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-[2rem] border border-border p-6">
          <h2 className="font-bold text-lg mb-4">Insights Rápidos</h2>
          <div className="space-y-4">
            {[
              { icon: TrendingUp, text: `${agents.filter(a => a.status === 'active').length} agentes ativos de ${agents.length}`, type: 'positive' as const },
              { icon: MessageSquare, text: `${overview?.todayConversations || 0} conversas hoje, ${overview?.activeConversations || 0} ativas no momento`, type: 'positive' as const },
              { icon: Users, text: `${overview?.totalContacts || 0} contatos registrados na base`, type: 'positive' as const },
              { icon: Bot, text: `${overview?.totalMessages?.toLocaleString() || 0} mensagens processadas no total`, type: 'positive' as const },
            ].map((insight) => (
              <div key={insight.text} className={cn(
                "p-4 rounded-2xl border flex items-start gap-3",
                insight.type === 'positive' ? 'bg-primary/5 border-primary/20' : 'bg-yellow-500/5 border-yellow-500/20'
              )}>
                <insight.icon className={cn("w-5 h-5 mt-0.5 shrink-0", insight.type === 'positive' ? 'text-primary' : 'text-yellow-500')} />
                <p className="text-xs text-muted leading-relaxed">{insight.text}</p>
              </div>
            ))}
          </div>
          <button onClick={downloadAnalyticsCsv} className="w-full mt-6 py-3 bg-bg border border-border rounded-xl text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text transition-all">
            Gerar Relatório Completo
          </button>
        </div>
      </div>
    </div>
  )
}

function KpiItem({ icon: Icon, label, value, change, up }: { icon: any; label: string; value: string; change: string; up: boolean }) {
  return (
    <div className="bg-surface rounded-2xl p-5 border border-border">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 bg-primary/5 rounded-xl">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-[9px] font-bold text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-display font-bold mb-0.5">{value}</p>
      <span className={cn("text-[10px] font-bold flex items-center gap-0.5", up ? 'text-primary' : 'text-red-500')}>
        <ArrowUpRight className={cn("w-3 h-3", !up && "rotate-90")} />
        {change}
      </span>
    </div>
  )
}
