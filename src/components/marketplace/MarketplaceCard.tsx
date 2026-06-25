import { Bot, Star, Download, MessageSquare, LucideIcon } from "lucide-react"
import { cn } from "@/src/lib/utils"

const segmentIcons: Record<string, LucideIcon> = {
  vendas: Bot,
  suporte: MessageSquare,
  retencao: Bot,
  saude: Bot,
  juridico: Bot,
  educacao: Bot,
  imobiliario: Bot,
  financeiro: Bot,
  rh: Bot,
  logistica: Bot,
  ecommerce: Bot,
}

const segmentColors: Record<string, string> = {
  vendas: 'from-emerald-500 to-green-600',
  suporte: 'from-blue-500 to-cyan-600',
  retencao: 'from-purple-500 to-pink-600',
  saude: 'from-red-500 to-rose-600',
  juridico: 'from-indigo-500 to-blue-600',
  educacao: 'from-orange-500 to-amber-600',
  imobiliario: 'from-teal-500 to-emerald-600',
  financeiro: 'from-yellow-500 to-orange-600',
  rh: 'from-sky-500 to-indigo-600',
  logistica: 'from-slate-500 to-gray-600',
  ecommerce: 'from-pink-500 to-rose-600',
}

interface MarketplaceCardProps {
  agent: any
  onInstall?: (id: string) => void
  onView?: (id: string) => void
  key?: any
}

export function MarketplaceCard({
  agent,
  onInstall,
  onView,
}: MarketplaceCardProps) {
  const Icon = segmentIcons[agent.segment] || Bot

  return (
    <div
      className="bg-surface rounded-[2rem] border border-border overflow-hidden hover:border-primary/30 transition-all group cursor-pointer"
      onClick={() => onView?.(agent.id)}
    >
      <div className={cn("h-24 bg-gradient-to-br flex items-center justify-center relative overflow-hidden", segmentColors[agent.segment] || 'from-primary to-emerald-600')}>
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />
        <Icon className="w-10 h-10 text-white/80" />
        <div className="absolute top-3 right-3 px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[9px] font-bold text-white uppercase tracking-wider">
          {agent.segment}
        </div>
      </div>

      <div className="p-5">
        <h3 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors line-clamp-1">{agent.name}</h3>
        <p className="text-xs text-muted leading-relaxed line-clamp-2 mb-4 h-8">{agent.description}</p>

        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold">{agent.rating}</span>
            <span className="text-[10px] text-muted">({agent.installs})</span>
          </div>
          <div className="flex items-center gap-1 text-muted">
            <Download className="w-3 h-3" />
            <span className="text-[10px] font-medium">{agent.installs.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg",
            agent.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted/10 text-muted'
          )}>
            {agent.llmConfig?.provider || 'gemini'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onInstall?.(agent.id) }}
            className="px-4 py-1.5 bg-primary text-white text-[10px] font-bold rounded-xl hover:bg-primary/90 transition-all uppercase tracking-wider"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  )
}
