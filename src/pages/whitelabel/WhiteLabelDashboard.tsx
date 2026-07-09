import { useEffect, useState } from "react"
import { Bot, Building2, MessageSquare, Phone, Users } from "lucide-react"
import { api } from "@/src/lib/api"

const metrics = [
  { key: "totalTenants", label: "Clientes", icon: Building2 },
  { key: "totalUsers", label: "Usuarios", icon: Users },
  { key: "totalAgents", label: "Agentes IA", icon: Bot },
  { key: "totalConversations", label: "Conversas", icon: MessageSquare },
]

export default function WhiteLabelDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getWhiteLabelStats().then((res) => setStats(res.stats)).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="py-20 flex justify-center"><div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">{stats?.whiteLabel?.name || "White Label"}</h1>
        <p className="text-sm text-muted mt-1">Operacao, clientes finais e consumo da sua marca</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {metrics.map((item) => (
          <div key={item.key} className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted font-bold uppercase tracking-wider">{item.label}</p>
                <p className="text-3xl font-display font-bold text-text mt-2">{stats?.[item.key] || 0}</p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-teal-50 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-teal-700" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-teal-700" />
          <h2 className="font-bold text-text">Capacidade contratada</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="bg-bg border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase font-bold">Plano</p>
            <p className="font-semibold text-text mt-1">{stats?.whiteLabel?.planId || "Sem plano"}</p>
          </div>
          <div className="bg-bg border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase font-bold">Dominio</p>
            <p className="font-semibold text-text mt-1">{stats?.whiteLabel?.customDomain || "Nao configurado"}</p>
          </div>
          <div className="bg-bg border border-border rounded-lg p-4">
            <p className="text-xs text-muted uppercase font-bold">Status</p>
            <p className="font-semibold text-text mt-1">{stats?.whiteLabel?.status || "active"}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
