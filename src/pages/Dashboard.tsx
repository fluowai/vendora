import { 
  Users, 
  MessageSquare, 
  TrendingUp, 
  Clock, 
  ArrowUpRight,
  ChevronRight,
  MoreVertical
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { cn } from "@/src/lib/utils";

const data = [
  { name: "Seg", conversas: 400, vendas: 240 },
  { name: "Ter", conversas: 300, vendas: 139 },
  { name: "Qua", conversas: 200, vendas: 980 },
  { name: "Qui", conversas: 278, vendas: 390 },
  { name: "Sex", conversas: 189, vendas: 480 },
  { name: "Sáb", conversas: 239, vendas: 380 },
  { name: "Dom", conversas: 349, vendas: 430 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 lg:space-y-8 pb-10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold mb-1">Bem-vindo de volta!</h1>
          <p className="text-muted text-sm lg:text-base">Veja como sua operação comercial está performando hoje.</p>
        </div>
        <button className="bg-primary text-white px-6 py-3 rounded-xl lg:rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/10">
          Nova Campanha
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
        <KpiCard 
          icon={MessageSquare} 
          label="Conversas" 
          value="1,284" 
          change="+12.5%" 
          positive={true} 
        />
        <KpiCard 
          icon={Users} 
          label="Leads" 
          value="452" 
          change="+8.2%" 
          positive={true} 
        />
        <KpiCard 
          icon={TrendingUp} 
          label="Vendas" 
          value="R$ 48k" 
          change="+14.1%" 
          positive={true} 
        />
        <KpiCard 
          icon={Clock} 
          label="Resposta" 
          value="45s" 
          change="-22%" 
          positive={true} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-surface rounded-[2rem] lg:rounded-3xl border border-border p-5 lg:p-8 card-shadow">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg lg:text-xl font-display font-bold">Volume de Conversas</h2>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-muted uppercase tracking-wider">
                <div className="w-2 h-2 rounded-full bg-primary" /> Atendimento
              </span>
            </div>
          </div>
          <div className="h-[250px] lg:h-[300px] -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#25D366" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#25D366" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eeeeee" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }} 
                />
                <Area type="monotone" dataKey="conversas" stroke="#25D366" strokeWidth={3} fillOpacity={1} fill="url(#colorPrimary)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-surface rounded-[2rem] lg:rounded-3xl border border-border p-6 lg:p-8 card-shadow">
          <div className="flex items-center justify-between mb-6 lg:mb-8">
            <h2 className="text-lg lg:text-xl font-display font-bold">Atividade</h2>
            <button className="text-muted hover:text-text"><MoreVertical className="w-5 h-5" /></button>
          </div>
          <div className="space-y-6">
            <ActivityItem 
              contact="Felipe Amorim" 
              action="Comprou Plano Growth" 
              time="2 min atrás" 
              type="sale"
            />
            <ActivityItem 
              contact="Ana Costa" 
              action="Novo lead qualificado por IA" 
              time="15 min atrás" 
              type="lead"
            />
            <ActivityItem 
              contact="Eduardo Lima" 
              action="Respondeu Campanha" 
              time="1h atrás" 
              type="campaign"
            />
          </div>
          <button className="w-full mt-8 py-3 rounded-2xl bg-[#F8FAFC] border border-border text-xs font-bold uppercase tracking-widest text-muted hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 group">
            Ver tudo
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, change, positive }: { icon: any, label: string, value: string, change: string, positive: boolean }) {
  return (
    <div className="bg-surface rounded-3xl p-6 border border-border card-shadow hover:border-primary/20 transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary/10 transition-colors">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <span className={cn(
          "text-xs font-bold px-2 py-1 rounded-lg",
          positive ? "bg-primary/10 text-primary" : "bg-red-500/10 text-red-500"
        )}>
          {change}
        </span>
      </div>
      <div>
        <h3 className="text-2xl font-display font-bold mb-1">{value}</h3>
        <p className="text-muted text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function ActivityItem({ contact, action, time, type }: { contact: string, action: string, time: string, type: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className={cn(
        "w-2 h-12 rounded-full",
        type === 'sale' ? 'bg-primary' : type === 'lead' ? 'bg-accent' : 'bg-muted/20'
      )} />
      <div className="flex-1">
        <p className="text-sm font-bold text-white mb-0.5">{contact}</p>
        <p className="text-xs text-muted mb-1">{action}</p>
        <span className="text-[10px] text-muted/60">{time}</span>
      </div>
    </div>
  );
}
