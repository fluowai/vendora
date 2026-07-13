import { useState, useEffect } from "react"
import { Plus, CreditCard, CheckCircle, XCircle, Edit2, Trash2 } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface Plan {
  id: string; name: string; price: number
  maxAgents: number; maxConversations: number; maxChannels: number; maxUsers: number
  features: any; isActive: boolean
}

export default function SuperAdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [form, setForm] = useState({
    id: "", name: "", price: 0, maxAgents: 1, maxConversations: 500,
    maxChannels: 1, maxUsers: 1, features: "[]", isActive: true,
  })

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const token = localStorage.getItem("vendaora_token")
        const res = await window.fetch("/api/superadmin/plans", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (res.ok) setPlans(data.plans)
      } catch {}
      finally { setLoading(false) }
    }
    loadPlans()
  }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ id: "", name: "", price: 0, maxAgents: 1, maxConversations: 500, maxChannels: 1, maxUsers: 1, features: "[]", isActive: true })
    setShowForm(true)
  }

  const openEdit = (plan: Plan) => {
    setEditing(plan)
    setForm({
      id: plan.id, name: plan.name, price: plan.price,
      maxAgents: plan.maxAgents, maxConversations: plan.maxConversations,
      maxChannels: plan.maxChannels, maxUsers: plan.maxUsers,
      features: JSON.stringify(plan.features || []), isActive: plan.isActive,
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    try {
      const token = localStorage.getItem("vendaora_token")
      const body = { ...form, price: Number(form.price), features: JSON.parse(form.features) }
      const url = editing ? `/api/superadmin/plans/${editing.id}` : "/api/superadmin/plans"
      const method = editing ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowForm(false); setEditing(null)
        const data = await fetch("/api/superadmin/plans", { headers: { Authorization: `Bearer ${token}` } })
        const json = await data.json()
        if (data.ok) setPlans(json.plans)
      }
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir plano? Clientes ou revendas com este plano precisam ser alterados antes.")) return
    try {
      const token = localStorage.getItem("vendaora_token")
      const res = await fetch(`/api/superadmin/plans/${id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setPlans(plans.filter((p) => p.id !== id))
      } else {
        alert(data.error || "Nao foi possivel excluir o plano.")
      }
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Planos</h1>
          <p className="text-sm text-muted mt-1">Gerencie os planos de assinatura da plataforma</p>
        </div>
        <button onClick={openNew} className="px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> Novo Plano
        </button>
      </div>

      {showForm && (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-text">{editing ? "Editar" : "Novo"} Plano</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {!editing && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">ID *</label>
                <input type="text" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Nome *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Preço (R$)</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Máx. Agentes</label>
              <input type="number" value={form.maxAgents} onChange={(e) => setForm({ ...form, maxAgents: Number(e.target.value) })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Máx. Conversas/mês</label>
              <input type="number" value={form.maxConversations} onChange={(e) => setForm({ ...form, maxConversations: Number(e.target.value) })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Máx. Canais</label>
              <input type="number" value={form.maxChannels} onChange={(e) => setForm({ ...form, maxChannels: Number(e.target.value) })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Máx. Usuários</label>
              <input type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: Number(e.target.value) })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Features (JSON array)</label>
              <input type="text" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50 font-mono text-xs" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all">
              {editing ? "Salvar" : "Criar"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }} className="px-6 py-3 bg-bg border border-border rounded-xl font-bold text-sm text-muted hover:text-text transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className={cn(
              "bg-surface rounded-2xl border p-6 transition-all",
              plan.isActive ? "border-border" : "border-red-200 opacity-70"
            )}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-lg text-text capitalize">{plan.name}</h3>
                    {!plan.isActive && <span className="text-[10px] font-bold text-red-500 uppercase bg-red-50 px-2 py-0.5 rounded">Inativo</span>}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{plan.id}</p>
                </div>
                <CreditCard className="w-5 h-5 text-muted" />
              </div>
              <p className="text-3xl font-display font-bold text-text mb-4">R$ {plan.price.toFixed(2)}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Agentes</span><span className="font-semibold text-text">{plan.maxAgents === 999999 ? "∞" : plan.maxAgents}</span></div>
                <div className="flex justify-between"><span className="text-muted">Conversas/mês</span><span className="font-semibold text-text">{plan.maxConversations >= 99999999 ? "∞" : plan.maxConversations.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-muted">Canais</span><span className="font-semibold text-text">{plan.maxChannels === 999999 ? "∞" : plan.maxChannels}</span></div>
                <div className="flex justify-between"><span className="text-muted">Usuários</span><span className="font-semibold text-text">{plan.maxUsers === 999999 ? "∞" : plan.maxUsers}</span></div>
              </div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                <button onClick={() => openEdit(plan)} className="flex-1 py-2.5 bg-bg border border-border rounded-xl text-sm font-bold text-text hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5">
                  <Edit2 className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => handleDelete(plan.id)} className="py-2.5 px-4 bg-red-50 border border-red-100 rounded-xl text-sm font-bold text-red-500 hover:bg-red-100 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
