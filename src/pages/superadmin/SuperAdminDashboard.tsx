import { useState, useEffect } from "react"
import { Building2, Users, Bot, MessageSquare, ArrowUpRight, CreditCard, TrendingUp } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface Stats {
  totalTenants: number
  totalUsers: number
  totalAgents: number
  totalConversations: number
  plans: any[]
  tenantsByPlan: { planId: string; count: number }[]
}

const defaultStats: Stats = {
  totalTenants: 0, totalUsers: 0, totalAgents: 0, totalConversations: 0,
  plans: [], tenantsByPlan: [],
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats>(defaultStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("vendaora_token")
        const res = await fetch("/api/superadmin/stats", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) setStats(data.stats)
      } catch (err) {
        console.error("Failed to fetch stats:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const cards = [
    { icon: Building2, label: "Clientes", value: stats.totalTenants, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
    { icon: Users, label: "Usuários", value: stats.totalUsers, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
    { icon: Bot, label: "Agentes IA", value: stats.totalAgents, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100" },
    { icon: MessageSquare, label: "Conversas", value: stats.totalConversations, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Painel Super Admin</h1>
        <p className="text-muted text-sm mt-1">Visão geral de toda a plataforma Vendaora 360</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {cards.map((card) => (
              <div key={card.label} className={cn("rounded-2xl border p-6 bg-surface", card.border)}>
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.bg)}>
                    <card.icon className={cn("w-5 h-5", card.color)} />
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-muted" />
                </div>
                <p className="text-3xl font-display font-bold text-text">{card.value.toLocaleString()}</p>
                <p className="text-sm text-muted mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-muted" />
                <h2 className="font-bold text-text">Distribuição por Plano</h2>
              </div>
              {stats.tenantsByPlan.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">Nenhum dado disponível</p>
              ) : (
                <div className="space-y-3">
                  {stats.tenantsByPlan.map((item) => {
                    const total = stats.tenantsByPlan.reduce((a, b) => a + b.count, 0)
                    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                    return (
                      <div key={item.planId}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-text capitalize">{item.planId || "Sem plano"}</span>
                          <span className="text-muted">{item.count} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2 bg-bg rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              item.planId === "free" ? "bg-gray-400" :
                              item.planId === "growth" ? "bg-blue-500" :
                              item.planId === "pro" ? "bg-purple-500" : "bg-amber-500"
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-muted" />
                <h2 className="font-bold text-text">Planos Disponíveis</h2>
              </div>
              {stats.plans.length === 0 ? (
                <p className="text-sm text-muted py-8 text-center">Nenhum plano cadastrado</p>
              ) : (
                <div className="space-y-3">
                  {stats.plans.map((plan: any) => (
                    <div key={plan.id} className="flex items-center justify-between p-3 rounded-xl bg-bg border border-border">
                      <div>
                        <p className="font-semibold text-text capitalize">{plan.name}</p>
                        <p className="text-xs text-muted">{plan.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-text">R$ {plan.price?.toFixed(2)}</p>
                        <p className="text-[10px] text-muted">{plan.maxAgents} agentes • {plan.maxConversations.toLocaleString()} conversas</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
