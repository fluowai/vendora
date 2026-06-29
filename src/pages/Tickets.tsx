import { Plus, Search, Filter, Ticket, Clock, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/lib/api";
import { useEffect, useState } from "react";

export default function Tickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState({ abertos: 0, slaVencido: 0, altaPrioridade: 0, resolvidosMes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      const data = await api.getTickets();
      setTickets(data.tickets);
      setStats(data.stats);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="p-8 text-muted">Carregando...</div>;

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
          <p className="text-3xl font-display font-bold text-text mt-2">{stats.abertos}</p>
        </div>
        <div className="bg-[#FFF4F2] p-4 lg:p-6 rounded-2xl border border-red-100 shadow-sm">
          <span className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-1"><Clock className="w-3 h-3"/> SLA Vencido</span>
          <p className="text-3xl font-display font-bold text-red-600 mt-2">{stats.slaVencido}</p>
        </div>
        <div className="bg-[#FEF9C3] p-4 lg:p-6 rounded-2xl border border-yellow-200 shadow-sm">
          <span className="text-xs font-bold text-yellow-600 uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Alta Prioridade</span>
          <p className="text-3xl font-display font-bold text-yellow-700 mt-2">{stats.altaPrioridade}</p>
        </div>
        <div className="bg-[#E8F6F0] p-4 lg:p-6 rounded-2xl border border-[#25D366]/20 shadow-sm">
          <span className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Resolvidos (Mês)</span>
          <p className="text-3xl font-display font-bold text-[#128C7E] mt-2">{stats.resolvidosMes}</p>
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
              {tickets.map((t: any) => (
                <tr key={t.id} className="hover:bg-bg/50 transition-all group cursor-pointer">
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm">#{t.id.slice(0, 8)}</span>
                    <p className="text-[10px] text-muted">{new Date(t.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4 font-medium text-sm">{t.title}</td>
                  <td className="px-6 py-4 text-sm">{t.contact?.name || "—"}</td>
                  <td className="px-6 py-4"><span className="text-xs bg-bg px-2 py-1 rounded font-bold">{t.department?.name || "—"}</span></td>
                  <td className="px-6 py-4">
                    <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      t.status === 'resolvido' || t.status === 'fechado' ? 'bg-green-50 text-green-600 border-green-200' :
                      t.status === 'aberto' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                      'bg-yellow-50 text-yellow-600 border-yellow-200'
                    )}>{t.status}</span>
                  </td>
                  <td className="px-6 py-4">
                    {t.slaDueAt && new Date(t.slaDueAt) < new Date() && t.status !== 'resolvido' && t.status !== 'fechado' ? (
                      <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Vencido</span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-white rounded-lg text-muted opacity-0 group-hover:opacity-100 transition-all border border-transparent group-hover:border-border shadow-sm">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-muted">Nenhum ticket encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
