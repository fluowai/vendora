import { 
  ShieldAlert, Plus, Search, Filter, Clock, CheckCircle2, 
  AlertTriangle, MessageSquare, Tag, FileText, ChevronRight 
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/lib/api";

const statusLabels: Record<string, string> = {
  nova: "Nova",
  em_apuracao: "Em Apuração",
  aguardando_resposta: "Aguardando Resposta",
  encaminhado: "Encaminhado",
  encerrado: "Encerrado",
};

export default function Ombudsman() {
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalAbertos: 0, slaVencido: 0, urgentes: 0, resolvidosMes: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    try {
      const data = await api.getOmbudsmanCases();
      setCases(data.cases);
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
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold flex items-center gap-2 mb-1">
            <ShieldAlert className="w-6 h-6 lg:w-8 lg:h-8 text-primary" /> Ouvidoria 360
          </h1>
          <p className="text-muted text-sm lg:text-base">Gestão de manifestações, reclamações, denúncias e SLA.</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input type="text" placeholder="Buscar protocolo..." className="w-56 bg-white border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-all shadow-sm" />
          </div>
          <button className="p-2.5 bg-white border border-border rounded-xl hover:bg-bg transition-all shadow-sm"><Filter className="w-5 h-5 text-muted" /></button>
          <button className="flex-1 lg:flex-none bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-md">
            <Plus className="w-5 h-5" /> Novo Protocolo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 lg:p-6 rounded-2xl border border-border shadow-sm flex flex-col">
          <span className="text-xs font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-1"><FileText className="w-3 h-3"/> Total Abertos</span>
          <span className="text-3xl font-display font-bold text-text">{stats.totalAbertos}</span>
        </div>
        <div className="bg-[#FFF4F2] p-4 lg:p-6 rounded-2xl border border-red-100 shadow-sm flex flex-col">
          <span className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center gap-1"><Clock className="w-3 h-3"/> SLA Vencido</span>
          <span className="text-3xl font-display font-bold text-red-600">{stats.slaVencido}</span>
        </div>
        <div className="bg-[#FEF9C3] p-4 lg:p-6 rounded-2xl border border-yellow-200 shadow-sm flex flex-col">
          <span className="text-xs font-bold text-yellow-600 uppercase tracking-widest mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Urgentes</span>
          <span className="text-3xl font-display font-bold text-yellow-700">{stats.urgentes}</span>
        </div>
        <div className="bg-[#E8F6F0] p-4 lg:p-6 rounded-2xl border border-[#25D366]/20 shadow-sm flex flex-col">
          <span className="text-xs font-bold text-[#25D366] uppercase tracking-widest mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Resolvidos (Mês)</span>
          <span className="text-3xl font-display font-bold text-[#128C7E]">{stats.resolvidosMes}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 bg-white border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg border-b border-border">
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Protocolo</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Manifestante</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Tipo/Categoria</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-muted uppercase tracking-wider">SLA</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.map((p: any) => (
                <tr key={p.id} className="hover:bg-bg/50 transition-colors group cursor-pointer">
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm">{p.protocolNumber}</span>
                    <p className="text-[10px] text-muted">{new Date(p.createdAt).toLocaleDateString()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center font-bold text-muted text-xs">
                        {p.anonymous ? '?' : (p.contact?.name?.charAt(0) || '?')}
                      </div>
                      <span className="font-bold text-sm">{p.anonymous ? 'Anônimo' : (p.contact?.name || '—')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-sm text-text block">{p.type}</span>
                    <span className="text-[10px] bg-bg px-2 py-0.5 rounded text-muted uppercase tracking-wider font-bold">{p.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      p.status === 'encerrado' ? 'bg-bg text-muted border-border' : 'bg-primary/10 text-primary border-primary/20'
                    )}>
                      {statusLabels[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {p.slaDueAt && new Date(p.slaDueAt) < new Date() && p.status !== 'encerrado' ? (
                        <span className="text-xs font-bold text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Vencido</span>
                      ) : (
                        <span className="text-xs font-bold text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-white rounded-lg text-muted opacity-0 group-hover:opacity-100 transition-all border border-transparent group-hover:border-border shadow-sm">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {cases.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted">Nenhum caso encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
