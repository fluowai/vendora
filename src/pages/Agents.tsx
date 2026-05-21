import { 
  Bot, 
  Plus, 
  Settings2, 
  Play, 
  Pause, 
  Trash2, 
  MessageSquare, 
  Target, 
  Briefcase,
  HelpCircle,
  Clock,
  Sparkles,
  Link
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/src/lib/utils";

const initialAgents = [
  { 
    id: '1', 
    name: 'SDR Vendas', 
    type: 'Vendas', 
    status: 'active', 
    model: 'Gemini 3 Flash', 
    conversas: 1240, 
    taxa: '82%',
    description: 'Especialista em qualificar novos leads que chegam pelo anúncio.' 
  },
  { 
    id: '2', 
    name: 'Suporte Técnico', 
    type: 'Suporte', 
    status: 'active', 
    model: 'Gemini 3 Pro', 
    conversas: 856, 
    taxa: '95%',
    description: 'Resolve dúvidas frequentes e escala problemas críticos para o time humano.' 
  },
  { 
    id: '3', 
    name: 'Assistente Pós-Venda', 
    type: 'Retenção', 
    status: 'paused', 
    model: 'Gemini 3 Flash', 
    conversas: 432, 
    taxa: '67%',
    description: 'Entra em contato 7 dias após a compra para garantir satisfação.' 
  },
];

export default function Agents() {
  const [agents] = useState(initialAgents);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold mb-1">Agentes de IA</h1>
          <p className="text-muted">Crie e gerencie sua equipe de inteligência artificial especializada.</p>
        </div>
        <button className="bg-primary text-bg px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-all">
          <Plus className="w-5 h-5" />
          Novo Agente
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Agent Templates Column */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-surface rounded-3xl border border-border p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Templates Prontos
            </h3>
            <div className="space-y-3">
              <TemplateItem icon={Briefcase} title="Vendedor SDR" desc="Foco em conversão e agenda." />
              <TemplateItem icon={HelpCircle} title="Suporte Nível 1" desc="Responde dúvidas comuns." />
              <TemplateItem icon={Target} title="Recuperação de Carrinho" desc="Reativa leads frios." />
              <TemplateItem icon={Clock} title="Agendamento" desc="Sincroniza com Google Calendar." />
            </div>
            <button className="w-full mt-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all uppercase tracking-widest">
              Ver todos os templates
            </button>
          </div>

          <div className="bg-primary/5 rounded-3xl border border-primary/20 p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all">
              <Bot className="w-20 h-20" />
            </div>
            <h3 className="font-bold text-primary mb-2">Base de Conhecimento</h3>
            <p className="text-xs text-muted mb-4">Conecte seus PDFs, URLs e documentos para treinar seus agentes automaticamente.</p>
            <button className="text-xs font-bold text-primary flex items-center gap-2 hover:translate-x-1 transition-all">
              Gerenciar Documentos <Link className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Existing Agents Column */}
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
          
          <button className="h-[280px] border-2 border-dashed border-border rounded-[2.5rem] flex flex-col items-center justify-center gap-4 text-muted hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-all">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-bold text-sm">Criar Agente do Zero</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateItem({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <button className="w-full p-4 bg-bg border border-border rounded-2xl text-left hover:border-primary/30 transition-all group">
      <div className="flex items-center gap-3 mb-1">
        <Icon className="w-4 h-4 text-muted group-hover:text-primary transition-all" />
        <span className="text-xs font-bold group-hover:text-white transition-all">{title}</span>
      </div>
      <p className="text-[10px] text-muted line-clamp-1">{desc}</p>
    </button>
  );
}

function AgentCard({ agent }: { agent: any }) {
  return (
    <div className="bg-surface rounded-[2.5rem] p-8 border border-border hover:border-primary/20 transition-all relative group overflow-hidden">
      {/* Status Badge */}
      <div className={cn(
        "absolute top-6 right-6 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
        agent.status === 'active' ? "bg-primary/10 text-primary border border-primary/20" : "bg-white/5 text-muted border border-white/10"
      )}>
        {agent.status === 'active' ? 'Ativo' : 'Pausado'}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
          <Bot className="w-7 h-7 text-primary" />
        </div>
        <div>
          <h3 className="font-display font-bold text-lg">{agent.name}</h3>
          <p className="text-xs text-muted flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> {agent.type} AI
          </p>
        </div>
      </div>

      <p className="text-sm text-muted mb-8 leading-relaxed h-10 line-clamp-2">
        {agent.description}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-3 bg-bg rounded-2xl border border-border">
          <p className="text-[10px] font-bold text-muted uppercase mb-1">Conversas</p>
          <p className="text-lg font-display font-bold tracking-tight">{agent.conversas.toLocaleString()}</p>
        </div>
        <div className="p-3 bg-bg rounded-2xl border border-border">
          <p className="text-[10px] font-bold text-muted uppercase mb-1">Eficiência</p>
          <p className="text-lg font-display font-bold tracking-tight text-primary">{agent.taxa}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <button className="flex-1 py-3 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2">
          <Settings2 className="w-4 h-4" /> Configurar
        </button>
        <button className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
          {agent.status === 'active' ? <Pause className="w-5 h-5 text-muted" /> : <Play className="w-5 h-5 text-primary" />}
        </button>
        <button className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center hover:bg-red-400/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
