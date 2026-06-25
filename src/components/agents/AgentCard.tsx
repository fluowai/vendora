import { Bot, Play, Pause, Settings2, Trash2, MessageSquare } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface AgentCardProps {
  agent: any
  onConfigure?: (id: string) => void
  onToggle?: (id: string) => void
  onDelete?: (id: string) => void
  key?: any
}

export function AgentCard({
  agent,
  onConfigure,
  onToggle,
  onDelete,
}: AgentCardProps) {
  return (
    <div className="bg-surface rounded-[2.5rem] p-6 border border-border hover:border-primary/20 transition-all relative group overflow-hidden">
      <div className={cn(
        "absolute top-5 right-5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
        agent.status === 'active' ? "bg-primary/10 text-primary border border-primary/20" : "bg-white/5 text-muted border border-white/10"
      )}>
        {agent.status === 'active' ? 'Ativo' : agent.status === 'paused' ? 'Pausado' : 'Rascunho'}
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-base truncate">{agent.name}</h3>
          <p className="text-[10px] text-muted flex items-center gap-1">
            <MessageSquare className="w-3 h-3" /> {agent.segment} · {agent.llmConfig?.provider}
          </p>
        </div>
      </div>

      <p className="text-xs text-muted leading-relaxed mb-5 line-clamp-2 h-8">{agent.description}</p>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="p-2.5 bg-bg rounded-xl border border-border">
          <p className="text-[9px] font-bold text-muted uppercase mb-0.5">Conversas</p>
          <p className="text-base font-display font-bold">{(agent.installs || 0).toLocaleString()}</p>
        </div>
        <div className="p-2.5 bg-bg rounded-xl border border-border">
          <p className="text-[9px] font-bold text-muted uppercase mb-0.5">Channels</p>
          <p className="text-base font-display font-bold">{(agent.channels?.length || 0)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <button onClick={() => onConfigure?.(agent.id)} className="flex-1 py-2.5 bg-white/5 rounded-xl text-[10px] font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-1.5">
          <Settings2 className="w-3.5 h-3.5" /> Configurar
        </button>
        <button onClick={() => onToggle?.(agent.id)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
          {agent.status === 'active' ? <Pause className="w-4 h-4 text-muted" /> : <Play className="w-4 h-4 text-primary" />}
        </button>
        <button onClick={() => onDelete?.(agent.id)} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-red-400/20 text-red-400 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
