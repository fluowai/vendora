import { Plus, Search, Filter, Ticket, Clock, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

const mockTickets = [
  { id: 'TK-1024', title: 'Problema com integração webhook', contact: 'João Silva', status: 'aberto', priority: 'high', department: 'Suporte Técnico', sla: 'Vence em 3h', date: 'Hoje, 14:30' },
  { id: 'TK-1023', title: 'Dúvida sobre faturamento', contact: 'Maria Souza', status: 'pendente', priority: 'medium', department: 'Financeiro', sla: 'Vence em 8h', date: 'Hoje, 11:00' },
  { id: 'TK-1022', title: 'Solicitação de novo usuário', contact: 'Eduardo Lima', status: 'resolvido', priority: 'low', department: 'Suporte Técnico', sla: '-', date: 'Ontem' },
];

export default function Tickets() {
  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold flex items-center gap-2 mb-1">
            <Ticket className="w-6 h-6 lg:w-8 lg:h-8 text-primary" /> Tickets de Suporte
          </h1>
          <p className="text-muted text-sm lg:text-base">Gestão de chamados de atendimento com SLA.</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input type="text" placeholder="Buscar ticket..." className="w-56 bg-white border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-all shadow-sm" />
          </div>
          <button className="p-2.5 bg-white border border-border rounded-xl hover:bg-bg transition-all shadow-sm"><Filter className="w-5 h-5 text-muted" /></button>
          <button className="flex-1 lg:flex-none bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-md">
            <Plus className="w-5 h-5" /> Novo Ticket
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 lg:p-6 rounded-2xl border border-border shadow-sm">
          <span className="text-xs font-bold text-muted uppercase tracking-widest">Abertos</span>
          <p className="text-3xl font-display font-bold text-text mt-2">8</p>
        </div>
        <div className="bg-[#FFF4F2] p-4 lg:p-6 rounded-2xl border border-red-100 shadow-sm">
          <span className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3"/> SLA Vencido</span>
          <p className="text-3xl font-display font-bold text-red-600 mt-2">2</p>
        </div>
        <div className="bg-[#FEF9C3] p-4 lg:p-6 rounded-2xl border border-yellow-200 shadow-sm">
          <span className="text-xs font-bold text-yellow-600 uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Alta Prioridade</span>
          <p className="text-3xl font-display font-bold text-yellow-700 mt-2">3</p>
        </div>
        <div className="bg-[#E8F6F0] p-4 lg:p-6 rounded-2xl border border-[#25D366]/20 shadow-sm">
          <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Resolvidos (Mês)</span>
          <p className="text-3xl font-display font-bold text-[#128C7E] mt-2">24</p>
        </div>
      </div>

      <div className="flex-1 bg-white border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border">
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Ticket</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Título</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Departamento</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">SLA</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockTickets.map(t => (
                <tr key={t.id} className="hover:bg-bg/50 transition-all group cursor-pointer">
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm">{t.id}</span>
                    <p className="text-[10px] text-muted">{t.date}</p>
                  </td>
                  <td className="px-6 py-4 font-medium text-sm">{t.title}</td>
                  <td className="px-6 py-4 text-sm">{t.contact}</td>
                  <td className="px-6 py-4"><span className="text-xs bg-bg px-2 py-1 rounded font-bold">{t.department}</span></td>
                  <td className="px-6 py-4">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border", 
                      t.status === 'resolvido' ? 'bg-green-50 text-green-600 border-green-200' : 
                      t.status === 'aberto' ? 'bg-blue-50 text-blue-600 border-blue-200' : 
                      'bg-yellow-50 text-yellow-600 border-yellow-200'
                    )}>{t.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {t.sla === 'Vencido' ? <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Vencido</span> :
                     t.sla === '-' ? <span className="text-xs text-muted">-</span> :
                     <span className="text-xs text-muted flex items-center gap-1"><Clock className="w-3 h-3"/> {t.sla}</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-white rounded-lg text-muted opacity-0 group-hover:opacity-100 transition-all border border-transparent group-hover:border-border shadow-sm">
                      <ChevronRight className="w-4 h-4" />
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
