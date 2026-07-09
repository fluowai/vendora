import { 
  Plus, 
  Filter, 
  MoreHorizontal, 
  DollarSign, 
  Search,
  ChevronDown,
  Activity,
  User,
  Clock,
  PhoneCall
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/src/lib/utils";
import { api } from "@/src/lib/api";
import { CallActionButton } from "../components/calls/CallActionButton";
import { formatPhoneForDisplay } from "../lib/phone";

export default function CRM() {
  const [funnels, setFunnels] = useState<any[]>([]);
  const [activeFunnel, setActiveFunnel] = useState("");
  const [stages, setStages] = useState<any[]>([]);
  const [isFunnelSelectOpen, setIsFunnelSelectOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadFunnels();
  }, []);

  useEffect(() => {
    if (activeFunnel) loadStages(activeFunnel);
  }, [activeFunnel]);

  async function loadFunnels() {
    try {
      const data = await api.getFunnels();
      setFunnels(data.funnels);
      if (data.funnels.length > 0 && !activeFunnel) {
        setActiveFunnel(data.funnels[0].id);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function loadStages(funnelId: string) {
    try {
      const data = await api.getFunnelStages(funnelId);
      setStages(data.stages);
    } catch (e: any) {
      console.error(e);
    }
  }

  async function createDeal(stageId?: string) {
    const stage = stageId ? stages.find((item) => item.id === stageId) : stages[0];
    if (!stage) {
      alert("Crie um funil e uma etapa antes de adicionar cards.");
      return;
    }
    const title = window.prompt("Titulo da oportunidade");
    if (!title?.trim()) return;
    const contactName = window.prompt("Nome do contato", "Lead sem nome");
    const valueText = window.prompt("Valor estimado em R$", "0");
    const value = Number(valueText || 0);
    await api.createDeal({
      title: title.trim(),
      contactName: contactName?.trim() || "Lead sem nome",
      value: value > 0 ? value : undefined,
      funnelId: activeFunnel,
      stageId: stage.id,
    });
    await loadStages(activeFunnel);
  }

  const visibleStages = stages.map((stage) => ({
    ...stage,
    deals: stage.deals.filter((deal: any) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return [deal.title, deal.contact?.name, deal.contact?.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    }),
  }));

  if (loading) return <div className="p-8 text-muted">Carregando...</div>;

  return (
    <div className="h-full flex flex-col space-y-4 lg:space-y-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-text">CRM Kanban</h1>
            
            {/* Funnel Selector */}
            <div className="relative">
              <button 
                onClick={() => setIsFunnelSelectOpen(!isFunnelSelectOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-bg border border-border rounded-lg hover:border-primary/50 transition-all font-bold text-sm"
              >
                {funnels.find(f => f.id === activeFunnel)?.name || "Selecione"}
                <ChevronDown className="w-4 h-4 text-muted" />
              </button>
              
              {isFunnelSelectOpen && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-border rounded-xl shadow-xl z-50 py-2">
                  {funnels.map(f => (
                    <button 
                      key={f.id}
                      onClick={() => { setActiveFunnel(f.id); setIsFunnelSelectOpen(false); }}
                      className={cn(
                        "w-full text-left px-4 py-2 text-sm font-bold hover:bg-bg transition-colors flex items-center gap-2",
                        activeFunnel === f.id ? "text-primary bg-primary/5" : "text-text"
                      )}
                    >
                      <Activity className="w-4 h-4" />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
          </div>
          <p className="text-muted text-sm lg:text-base">Mova cards entre etapas e crie automações visuais.</p>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar oportunidade..."
              className="w-48 bg-white border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-all shadow-sm"
            />
          </div>
          <button onClick={() => setSearch("")} className="p-2.5 bg-white border border-border rounded-xl hover:bg-bg transition-all shadow-sm" title="Limpar filtro">
            <Filter className="w-5 h-5 text-muted" />
          </button>
          <button onClick={() => createDeal()} className="flex-1 lg:flex-none bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-md">
            <Plus className="w-5 h-5" />
            <span className="text-sm">Novo Card</span>
          </button>
        </div>
      </div>

      {/* Board Area */}
      <div className="flex-1 overflow-x-auto pb-6 custom-scrollbar">
        {stages.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted">Nenhum funil ou etapa encontrada</div>
        ) : (
          <div className="flex gap-4 lg:gap-6 h-full min-h-[500px]">
            
            {visibleStages.map((stage) => (
              <div key={stage.id} className="kanban-column w-[300px] lg:w-[320px] flex-shrink-0 flex flex-col bg-[#F8FAFC] rounded-2xl border border-border/50">
                
                {/* Stage Header */}
                <div className="p-4 border-b border-border/50 bg-white rounded-t-2xl">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-text uppercase tracking-widest">{stage.name}</h3>
                      <span className="px-2 py-0.5 bg-bg text-muted rounded-full text-xs font-bold border border-border">{stage.count}</span>
                    </div>
                    <button onClick={() => createDeal(stage.id)} className="p-1 hover:bg-bg rounded-lg text-muted transition-colors" title="Adicionar card">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                  {stage.value > 0 && (
                    <p className="text-xs text-muted font-bold flex items-center gap-1">
                      <DollarSign className="w-3 h-3 text-primary" /> R$ {(stage.value / 1000).toFixed(1)}k em pipeline
                    </p>
                  )}
                </div>

                {/* Deals List */}
                <div className="flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar">
                  {stage.deals.map((deal: any) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
                  
                  {stage.deals.length === 0 && (
                    <div className="h-24 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-xs text-muted gap-2 bg-transparent">
                      Solte cards aqui
                    </div>
                  )}
                </div>
                
                {/* Add Deal Button in Stage */}
                <div className="p-3 pt-0">
                  <button onClick={() => createDeal(stage.id)} className="w-full py-2 hover:bg-white border border-transparent hover:border-border rounded-xl text-xs font-bold text-muted flex items-center justify-center gap-2 transition-all shadow-sm">
                    <Plus className="w-4 h-4" /> Adicionar Card
                  </button>
                </div>

              </div>
            ))}
            
            {/* Add Stage Button */}
            <button onClick={() => alert("Cadastro de etapas ainda nao possui endpoint no backend. Use as etapas existentes do funil.")} className="w-[300px] lg:w-[320px] flex-shrink-0 h-14 border-2 border-dashed border-border rounded-2xl flex items-center justify-center text-sm text-muted font-bold hover:bg-white hover:border-primary/30 hover:text-primary transition-all gap-2 bg-transparent">
              <Plus className="w-5 h-5" />
              Nova Etapa
            </button>
            
          </div>
        )}
      </div>
      
    </div>
  );
}

function DealCard({ deal }: { deal: any }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-border hover:border-primary/50 transition-all cursor-grab active:cursor-grabbing group shadow-sm hover:shadow-md">
      
      {/* Tags/Temperature */}
      {deal.temperature && (
        <div className="flex flex-wrap gap-1 mb-3">
          <span className="px-1.5 py-0.5 bg-[#F1F5F9] border border-border rounded text-[9px] font-bold text-muted uppercase tracking-wider">
            {deal.temperature}
          </span>
        </div>
      )}

      <div className="mb-3">
        <h4 className="font-bold text-sm text-text group-hover:text-primary transition-colors leading-tight mb-1">{deal.title}</h4>
        {deal.contact?.name && <span className="text-[11px] font-medium text-muted flex items-center gap-1"><User className="w-3 h-3"/> {deal.contact.name}</span>}
        {deal.contact?.companyName && <span className="text-[11px] font-medium text-muted ml-5">{deal.contact.companyName}</span>}
        {deal.contact?.phone && (
          <span className="text-[11px] font-medium text-muted flex items-center gap-1 mt-1">
            <PhoneCall className="w-3 h-3" /> {formatPhoneForDisplay(deal.contact.phone)}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        {deal.value ? (
          <div className="flex items-center gap-1 text-text font-bold text-xs bg-[#E8F6F0] px-2 py-1 rounded-lg text-primary border border-primary/10">
            <DollarSign className="w-3 h-3" />
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value)}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted font-bold text-[10px]">
             <Clock className="w-3 h-3" /> {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : '—'}
          </div>
        )}
        
        <div className="flex items-center gap-2">
          {deal.contact?.phone && (
            <CallActionButton
              phone={deal.contact.phone}
              source="crm-kanban"
              compact
              className="rounded-full"
            />
          )}
          {deal.score && (
            <span className="text-[10px] font-bold text-muted bg-bg px-1.5 py-0.5 rounded">{deal.score}pts</span>
          )}
          <div className={cn(
            "w-2 h-2 rounded-full",
            deal.temperature === 'quente' ? 'bg-red-500' : 
            deal.temperature === 'morno' ? 'bg-yellow-500' : 'bg-blue-500'
          )} />
        </div>
      </div>
      
    </div>
  );
}
