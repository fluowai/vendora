import { 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Calendar, 
  DollarSign, 
  Tag as TagIcon,
  Search
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/src/lib/utils";

const initialStages = [
  { 
    id: 'new', 
    title: 'Novo Lead', 
    count: 12, 
    deals: [
      { id: '1', name: 'João Silva', company: 'Nexus Inc', value: 'R$ 2.500', tags: ['WhatsApp', 'Growth'], priority: 'high' },
      { id: '2', name: 'Maria Souza', company: 'Soul Tech', value: 'R$ 1.200', tags: ['Instagram'], priority: 'medium' },
    ]
  },
  { 
    id: 'contact', 
    title: 'Em Contato', 
    count: 5, 
    deals: [
      { id: '3', name: 'Eduardo Lima', company: 'Green Field', value: 'R$ 5.000', tags: ['WhatsApp'], priority: 'high' },
    ]
  },
  { 
    id: 'qualified', 
    title: 'Qualificado', 
    count: 3, 
    deals: [
      { id: '4', name: 'Felipe Amorim', company: 'Blue Ocean', value: 'R$ 15.000', tags: ['API Oficial'], priority: 'low' },
    ]
  },
  { 
    id: 'proposal', 
    title: 'Proposta Enviada', 
    count: 2, 
    deals: []
  },
];

export default function CRM() {
  const [stages] = useState(initialStages);

  return (
    <div className="h-full flex flex-col space-y-4 lg:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold mb-1">CRM Kanban</h1>
          <p className="text-muted text-sm lg:text-base">Gerencie suas oportunidades de vendas de forma visual.</p>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="hidden sm:flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-bg bg-[#F1F5F9] flex items-center justify-center text-[10px] font-bold">
                U{i}
              </div>
            ))}
          </div>
          <button className="p-3 bg-surface border border-border rounded-xl lg:rounded-2xl hover:bg-bg transition-all">
            <Filter className="w-5 h-5 text-muted" />
          </button>
          <button className="flex-1 lg:flex-none bg-primary text-white px-6 py-3 rounded-xl lg:rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/10">
            <Plus className="w-5 h-5" />
            <span className="text-sm lg:text-base">Nova Oportunidade</span>
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-6 -mx-4 lg:mx-0 px-4 lg:px-0">
        <div className="flex gap-4 lg:gap-6 h-full min-h-[500px]">
          {stages.map((stage) => (
            <div key={stage.id} className="kanban-column w-[280px] lg:w-[320px] flex-shrink-0 flex flex-col bg-[#F8FAFC]">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-text">{stage.title}</h3>
                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold">{stage.count}</span>
                </div>
                <button className="p-1 hover:bg-primary/10 rounded-lg text-primary transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto pr-1 select-none">
                {stage.deals.map((deal) => (
                  <DealCard key={deal.id} deal={deal} />
                ))}
                
                {stage.deals.length === 0 && (
                  <div className="h-32 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-xs text-muted/40 gap-2 bg-white/50">
                    <Plus className="w-6 h-6 opacity-20" />
                    Nenhum card
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <button className="w-[280px] lg:w-[320px] flex-shrink-0 h-14 border border-dashed border-border rounded-2xl flex items-center justify-center text-sm text-muted hover:bg-white hover:border-primary/30 transition-all gap-2 bg-white/30 backdrop-blur-sm">
            <Plus className="w-4 h-4" />
            Adicionar Etapa
          </button>
        </div>
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: any }) {
  return (
    <div className="bg-card p-4 rounded-2xl border border-border hover:border-primary/40 transition-all cursor-grab active:cursor-grabbing group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted mb-1">{deal.company}</span>
          <h4 className="font-bold group-hover:text-primary transition-colors">{deal.name}</h4>
        </div>
        <button className="text-muted hover:text-white">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {deal.tags.map((tag: string) => (
          <span key={tag} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold text-muted uppercase tracking-wider">
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-1.5 text-primary">
          <DollarSign className="w-3 h-3" />
          <span className="text-xs font-bold">{deal.value}</span>
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase",
          deal.priority === 'high' ? 'bg-red-400/10 text-red-400' : 
          deal.priority === 'medium' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400'
        )}>
          {deal.priority}
        </div>
      </div>
    </div>
  );
}
