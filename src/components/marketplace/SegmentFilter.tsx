import {
  Bot, MessageSquare, Target, Heart, Scale,
  BookOpen, Home, DollarSign, Users, Truck, ShoppingCart, Sparkles
} from "lucide-react"
import { cn } from "@/src/lib/utils"

const segments = [
  { id: 'todos', label: 'Todos', icon: Sparkles },
  { id: 'vendas', label: 'Vendas', icon: Bot },
  { id: 'suporte', label: 'Suporte', icon: MessageSquare },
  { id: 'retencao', label: 'Retenção', icon: Target },
  { id: 'saude', label: 'Saúde', icon: Heart },
  { id: 'juridico', label: 'Jurídico', icon: Scale },
  { id: 'educacao', label: 'Educação', icon: BookOpen },
  { id: 'imobiliario', label: 'Imobiliário', icon: Home },
  { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
  { id: 'rh', label: 'RH', icon: Users },
  { id: 'logistica', label: 'Logística', icon: Truck },
  { id: 'ecommerce', label: 'E-commerce', icon: ShoppingCart },
]

export function SegmentFilter({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
      {segments.map((seg) => {
        const Icon = seg.icon
        const isActive = selected === seg.id
        return (
          <button
            key={seg.id}
            onClick={() => onSelect(seg.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
              isActive
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : "bg-surface text-muted border-border hover:border-primary/30 hover:text-text"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {seg.label}
          </button>
        )
      })}
    </div>
  )
}
