import { useState } from "react"
import {
  BarChart3, TrendingUp, Users, MessageSquare, DollarSign,
  Clock, Bot, ArrowUpRight, Download, Calendar, Filter
} from "lucide-react"
import { cn } from "@/src/lib/utils"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line, Legend
} from "recharts"

const weeklyData = [
  { name: "Seg", conversas: 450, leads: 78, resolucao: 92 },
  { name: "Ter", conversas: 520, leads: 95, resolucao: 88 },
  { name: "Qua", conversas: 480, leads: 82, resolucao: 94 },
  { name: "Qui", conversas: 610, leads: 112, resolucao: 90 },
  { name: "Sex", conversas: 560, leads: 98, resolucao: 86 },
  { name: "Sáb", conversas: 320, leads: 45, resolucao: 95 },
  { name: "Dom", conversas: 280, leads: 38, resolucao: 97 },
]

const agentPerformance = [
  { name: "SDR Vendas", conversas: 1240, taxa: 82, leads: 342, satisfacao: 4.8 },
  { name: "Suporte Técnico", conversas: 856, taxa: 95, leads: 128, satisfacao: 4.6 },
  { name: "Pós-Venda", conversas: 432, taxa: 67, leads: 89, satisfacao: 4.2 },
  { name: "Triagem Saúde", conversas: 234, taxa: 88, leads: 156, satisfacao: 4.5 },
  { name: "Tutor Virtual", conversas: 567, taxa: 91, leads: 45, satisfacao: 4.7 },
]

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
          <button className="p-2.5 bg-surface border border-border rounded-xl hover:bg-bg transition-all">
            <Download className="w-4 h-4 text-muted" />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiItem icon={MessageSquare} label="Conversas" value="3.829" change="+15.2%" up />
        <KpiItem icon={Users} label="Leads Gerados" value="892" change="+8.4%" up />
        <KpiItem icon={DollarSign} label="Receita" value="R$ 127k" change="+22.1%" up />
        <KpiItem icon={Bot} label="Agentes Ativos" value="8" change="+2" up />
        <KpiItem icon={Clock} label="Tempo Médio" value="12s" change="-18%" up />
        <KpiItem icon={TrendingUp} label="Conversão" value="23.4%" change="+3.2%" up />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversas Over Time */}
        <div className="lg:col-span-2 bg-surface rounded-[2rem] border border-border p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg">Volume de Conversas</h2>
            <span className="text-[10px] text-muted">Agentes vs Leads</span>
          </div>
          <div className="h-[280px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
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
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
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
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Conversas</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Resolução</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Leads</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Satisfação</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agentPerformance.map((agent) => (
                <tr key={agent.name} className="group hover:bg-bg/50 transition-all">
                  <td className="py-4 font-bold text-sm">{agent.name}</td>
                  <td className="py-4 text-sm">{agent.conversas.toLocaleString()}</td>
                  <td className="py-4">
                    <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-bold", agent.taxa >= 90 ? 'bg-primary/10 text-primary' : agent.taxa >= 75 ? 'bg-yellow-500/10 text-yellow-500' : 'bg-red-500/10 text-red-500')}>
                      {agent.taxa}%
                    </span>
                  </td>
                  <td className="py-4 text-sm">{agent.leads}</td>
                  <td className="py-4 text-sm">{agent.satisfacao}</td>
                  <td className="py-4">
                    <div className="w-24 h-2 bg-bg rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${agent.taxa}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Satisfaction Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-[2rem] border border-border p-6">
          <h2 className="font-bold text-lg mb-6">Evolução da Satisfação</h2>
          <div className="h-[200px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
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
              { icon: TrendingUp, text: 'Agente SDR Vendas com maior taxa de conversão (82%)', type: 'positive' },
              { icon: Clock, text: 'Tempo médio de resposta reduziu 18% este mês', type: 'positive' },
              { icon: Users, text: 'Segmento de Saúde cresceu 40% em leads', type: 'positive' },
              { icon: Bot, text: 'Agente Pós-Venda precisa de ajustes (67% eficiência)', type: 'warning' },
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
          <button className="w-full mt-6 py-3 bg-bg border border-border rounded-xl text-[10px] font-bold uppercase tracking-widest text-muted hover:text-text transition-all">
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
