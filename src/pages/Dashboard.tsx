import { useEffect, useState } from "react";
import {
  Users, MessageSquare, TrendingUp, Clock, ArrowUpRight, ChevronRight, Bot, Loader2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/lib/api";
import { useToast } from "@/src/components/Toast";

export default function Dashboard() {
  const [overview, setOverview] = useState<any>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let hasError = false;
    Promise.all([
      api.getAnalyticsOverview().then(r => setOverview(r.overview)).catch((e) => { hasError = true; setApiError(e.message); return null; }),
      api.getAnalyticsDaily(7).then(r => setDaily(r.daily)).catch((e) => { hasError = true; setApiError(e.message); return null; }),
      api.getAnalyticsAgents().then(r => setAgents(r.agents)).catch((e) => { hasError = true; setApiError(e.message); return null; }),
      api.getConversationsTrend(24).then(r => setTrend(r.trend)).catch((e) => { hasError = true; setApiError(e.message); return null; }),
    ]).finally(() => {
      setLoading(false);
      if (hasError) {
        toast("Alguns dados do dashboard não puderam ser carregados", "warning");
      }
    });
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold mb-1">Dashboard 360</h1>
          <p className="text-muted text-sm lg:text-base">Visão geral da operação em tempo real</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard icon={MessageSquare} label="Conversas Ativas" value={String(overview?.activeConversations || 0)}
          change={`+${overview?.todayConversations || 0} hoje`} positive />
        <KpiCard icon={Users} label="Contatos" value={String(overview?.totalContacts || 0)}
          change={`${overview?.totalConversations || 0} total`} positive />
        <KpiCard icon={Bot} label="Agentes IA" value={String(overview?.totalAgents || 0)}
          change={String(agents.length) + " configurados"} positive />
        <KpiCard icon={Clock} label="Mensagens" value={String(overview?.totalMessages || 0)}
          change="tempo real" positive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-surface rounded-[2rem] lg:rounded-3xl border border-border p-5 lg:p-8 card-shadow">
          <h2 className="text-lg lg:text-xl font-display font-bold mb-6">Volume Semanal</h2>
          <div className="h-[250px] lg:h-[300px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily.length > 0 ? daily : [{ name: "Sem dados", conversas: 0, vendas: 0 }]}>
                <defs>
                  <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="conversas" stroke="#25D366" strokeWidth={3} fillOpacity={1} fill="url(#colorPrimary)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-[2rem] lg:rounded-3xl border border-border p-6 lg:p-8 card-shadow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg lg:text-xl font-display font-bold">Agentes</h2>
          </div>
          <div className="space-y-4">
            {agents.slice(0, 5).map((agent) => (
              <div key={agent.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{agent.name}</p>
                    <p className="text-[10px] text-muted">{agent.segment} · {(agent as any).conversationsCount || 0} convs</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${agent.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                  {agent.status}
                </span>
              </div>
            ))}
            {agents.length === 0 && <p className="text-sm text-muted">Nenhum agente configurado</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-3xl border border-border p-6 card-shadow">
          <h3 className="font-display font-bold mb-4">Conversas por Status</h3>
          {overview?.conversationsByStatus?.length > 0 ? (
            <div className="space-y-3">
              {overview.conversationsByStatus.map((s: any) => (
                <div key={s.status} className="flex items-center gap-3">
                  <div className="flex-1 h-3 bg-bg rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, (s.count / Math.max(1, overview.activeConversations)) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-bold w-20">{s.status}</span>
                  <span className="text-xs text-muted">{s.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted">Nenhuma conversa ainda</p>}
        </div>

        <div className="bg-surface rounded-3xl border border-border p-6 card-shadow">
          <h3 className="font-display font-bold mb-4">Conversas por Canal</h3>
          {overview?.conversationsByChannel?.length > 0 ? (
            <div className="space-y-3">
              {overview.conversationsByChannel.map((c: any) => (
                <div key={c.channel} className="flex items-center justify-between p-3 bg-bg rounded-xl">
                  <span className="text-sm font-bold">{c.channel}</span>
                  <span className="text-sm text-muted">{c.count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted">Nenhum canal conectado</p>}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, change, positive }: { icon: any; label: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="bg-surface rounded-3xl p-6 border border-border card-shadow hover:border-primary/20 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <span className={cn("text-xs font-bold px-2 py-1 rounded-lg", positive ? "bg-primary/10 text-primary" : "bg-red-500/10 text-red-500")}>
          {change}
        </span>
      </div>
      <h3 className="text-2xl font-display font-bold mb-1">{value}</h3>
      <p className="text-muted text-xs font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}
