import { Zap, Plus, Play, Pause, MoreVertical, GitBranch, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/src/lib/utils";

const mockFlows = [
  { id: '1', name: 'Roteamento WhatsApp', description: 'Recebe msg, aciona Recepcionista IA, transfere setor.', status: 'active', triggers: 1250 },
  { id: '2', name: 'Qualificação Instagram', description: 'Aciona IA SDR para DM de novos seguidores.', status: 'active', triggers: 840 },
  { id: '3', name: 'Alerta SLA Ouvidoria', description: 'Avisa gestor quando ticket de ouvidoria vai vencer.', status: 'paused', triggers: 0 },
];

export default function Automations() {
  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold flex items-center gap-2 mb-1">
            <Zap className="w-6 h-6 lg:w-8 lg:h-8 text-primary" /> Automações Visuais
          </h1>
          <p className="text-muted text-sm lg:text-base">Crie gatilhos, condições e ações arrastando blocos.</p>
        </div>
        <button className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-md">
          <Plus className="w-5 h-5" /> Criar Fluxo
        </button>
      </div>

      {/* Empty State / Dashboard Area */}
      <div className="flex-1 bg-surface rounded-3xl border border-border flex flex-col lg:flex-row gap-6 p-6">
        
        {/* Lista de Fluxos */}
        <div className="w-full lg:w-1/3 flex flex-col space-y-4">
          <h3 className="font-bold uppercase tracking-widest text-xs text-muted">Meus Fluxos</h3>
          
          {mockFlows.map(flow => (
            <div key={flow.id} className="bg-white p-4 rounded-2xl border border-border shadow-sm hover:border-primary/40 transition-all cursor-pointer group">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", flow.status === 'active' ? 'bg-green-500' : 'bg-gray-400')} />
                  <h4 className="font-bold text-sm">{flow.name}</h4>
                </div>
                <button className="text-muted hover:text-text"><MoreVertical className="w-4 h-4"/></button>
              </div>
              <p className="text-xs text-muted mb-4">{flow.description}</p>
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-[10px] font-bold text-muted flex items-center gap-1"><Play className="w-3 h-3"/> {flow.triggers} execuções</span>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", flow.status === 'active' ? 'text-green-500' : 'text-gray-400')}>
                  {flow.status === 'active' ? 'Ativo' : 'Pausado'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Simulador Builder Visual (Placeholder para React Flow) */}
        <div className="flex-1 bg-surface border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-[100px_100px_100px_100px_100px] grid-rows-[100px_100px_100px_100px_100px] opacity-[0.03]">
             {/* Simple grid background pattern */}
             {Array.from({length: 25}).map((_, i) => (
                <div key={i} className="border-r border-b border-black" />
             ))}
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            {/* Visual Block 1 */}
            <div className="bg-white border-2 border-primary/20 rounded-xl p-4 shadow-lg w-64 mb-6 relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center"><Zap className="w-3 h-3 text-purple-600"/></div>
                <span className="text-xs font-bold uppercase text-muted">Gatilho</span>
              </div>
              <p className="font-bold text-sm">Nova mensagem WhatsApp</p>
              
              <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 w-1 h-6 bg-border" />
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-3 h-3 border-r-2 border-b-2 border-border rotate-45" />
            </div>

            {/* Visual Block 2 */}
            <div className="bg-white border-2 border-blue-200 rounded-xl p-4 shadow-lg w-64 mb-6 relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center"><GitBranch className="w-3 h-3 text-blue-600"/></div>
                <span className="text-xs font-bold uppercase text-muted">Condição</span>
              </div>
              <p className="font-bold text-sm">Horário Comercial?</p>
              
              <div className="absolute -bottom-7 left-1/4 -translate-x-1/2 w-1 h-6 bg-border" />
              <div className="absolute -bottom-7 left-3/4 -translate-x-1/2 w-1 h-6 bg-border" />
            </div>

            <div className="flex gap-12">
              {/* Visual Block 3 */}
              <div className="bg-white border-2 border-green-200 rounded-xl p-4 shadow-lg w-48 opacity-50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center"><MessageSquare className="w-3 h-3 text-green-600"/></div>
                  <span className="text-xs font-bold uppercase text-muted">Ação</span>
                </div>
                <p className="font-bold text-sm">Acionar Agente IA</p>
              </div>
              
              {/* Visual Block 4 */}
              <div className="bg-white border-2 border-orange-200 rounded-xl p-4 shadow-lg w-48 opacity-50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded bg-orange-100 flex items-center justify-center"><ArrowRight className="w-3 h-3 text-orange-600"/></div>
                  <span className="text-xs font-bold uppercase text-muted">Ação</span>
                </div>
                <p className="font-bold text-sm">Msg Fora de Horário</p>
              </div>
            </div>

            <button className="mt-12 bg-white text-primary border border-primary/20 px-6 py-2 rounded-xl font-bold shadow-sm hover:bg-primary/5 transition-all">
              Abrir Construtor React Flow
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
