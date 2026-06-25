import { 
  Megaphone, 
  Plus, 
  Users, 
  Send, 
  Calendar, 
  BarChart, 
  Clock, 
  Search,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/src/lib/utils";

const campaigns = [
  { id: '1', title: 'Black Friday 2024', status: 'sent', date: '15 Nov 2024', reach: '5,000', open: '3,200', response: '850', color: 'bg-primary' },
  { id: '2', title: 'Natal Antecipado', status: 'scheduled', date: '10 Dez 2024', reach: '2,500', open: '-', response: '-', color: 'bg-accent' },
  { id: '3', title: 'Recuperação Outubro', status: 'draft', date: 'Pendente', reach: '800', open: '-', response: '-', color: 'bg-muted' },
];

export default function Campaigns() {
  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1">Campanhas</h1>
          <p className="text-muted">Dispare mensagens em massa e acompanhe o engajamento em tempo real.</p>
        </div>
        <button className="bg-primary text-bg px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-all">
          <Plus className="w-5 h-5" />
          Nova Campanha
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={Users} label="Total Alcance" value="12k" />
        <StatCard icon={BarChart} label="Taxa Resp. Média" value="18.5%" />
        <StatCard icon={Send} label="Enviadas (Mês)" value="8" />
      </div>

      <div className="bg-surface rounded-[2.5rem] border border-border p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4 bg-bg px-4 py-2 rounded-xl border border-border w-80">
            <Search className="w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Buscar campanhas..." 
              className="bg-transparent border-none outline-none text-xs w-full"
            />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 bg-bg text-muted text-[10px] font-bold rounded-lg border border-border hover:bg-surface hover:text-text">TODAS</button>
            <button className="px-3 py-1.5 bg-bg text-muted text-[10px] font-bold rounded-lg border border-border hover:bg-surface hover:text-text">ENVIADAS</button>
            <button className="px-3 py-1.5 bg-bg text-muted text-[10px] font-bold rounded-lg border border-border hover:bg-surface hover:text-text">AGENDADAS</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Campanha</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Data</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest">Alcance</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest text-right pr-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {campaigns.map((camp) => (
                <tr key={camp.id} className="group hover:bg-bg/50 transition-all">
                  <td className="py-6 pl-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", camp.color)}>
                        <Megaphone className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm group-hover:text-primary transition-colors">{camp.title}</span>
                    </div>
                  </td>
                  <td className="py-6">
                    <div className="flex items-center gap-2">
                      {camp.status === 'sent' ? <CheckCircle2 className="w-3 h-3 text-primary" /> : <Clock className="w-3 h-3 text-muted" />}
                      <span className={cn(
                        "text-[10px] font-bold uppercase",
                        camp.status === 'sent' ? 'text-primary' : 'text-muted'
                      )}>
                        {camp.status === 'sent' ? 'Enviada' : camp.status === 'scheduled' ? 'Agendada' : 'Rascunho'}
                      </span>
                    </div>
                  </td>
                  <td className="py-6 text-sm text-muted">{camp.date}</td>
                  <td className="py-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{camp.reach}</span>
                      <span className="text-[10px] text-muted">{camp.response ? `${camp.response} respostas` : 'Aguardando'}</span>
                    </div>
                  </td>
                  <td className="py-6 text-right pr-4">
                    <button className="p-2 hover:bg-bg rounded-lg transition-all text-muted hover:text-text">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-surface p-6 rounded-3xl border border-border flex items-center gap-4 card-shadow">
      <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-display font-bold">{value}</p>
      </div>
    </div>
  );
}
