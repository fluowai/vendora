import { useEffect, useState } from "react"
import { Building2, Plus, Search } from "lucide-react"
import { api } from "@/src/lib/api"

export default function WhiteLabelTenants() {
  const [tenants, setTenants] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "", slug: "", email: "", adminName: "", adminEmail: "", adminPassword: "" })

  const load = () => api.getWhiteLabelTenants({ search }).then((res) => setTenants(res.tenants))

  useEffect(() => { load() }, [search])

  const createTenant = async () => {
    if (!form.name || !form.slug) return
    setCreating(true)
    try {
      await api.createWhiteLabelTenant({
        name: form.name,
        slug: form.slug,
        email: form.email,
        planId: "growth",
        admin: form.adminEmail && form.adminPassword ? {
          name: form.adminName,
          email: form.adminEmail,
          password: form.adminPassword,
        } : undefined,
      })
      setForm({ name: "", slug: "", email: "", adminName: "", adminEmail: "", adminPassword: "" })
      await load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Clientes</h1>
        <p className="text-sm text-muted mt-1">Empresas finais vinculadas ao seu white label</p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da empresa" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="slug-da-empresa" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email comercial" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} placeholder="Nome do Admin" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} placeholder="email do admin" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <div className="flex gap-3">
            <input type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} placeholder="senha inicial" className="min-w-0 flex-1 bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
            <button onClick={createTenant} disabled={creating} className="px-4 py-3 bg-teal-700 text-white rounded-lg font-bold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Criar
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." className="w-full bg-surface border border-border rounded-lg py-3 pl-11 pr-4 text-sm outline-none" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {tenants.map((tenant) => (
          <div key={tenant.id} className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-teal-700" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-text truncate">{tenant.name}</h2>
                  <p className="text-xs text-muted">{tenant.slug}</p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-emerald-50 text-emerald-700">{tenant.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5 text-center">
              <div className="bg-bg rounded-lg p-3"><p className="font-bold text-text">{tenant._count?.users || 0}</p><p className="text-xs text-muted">Usuarios</p></div>
              <div className="bg-bg rounded-lg p-3"><p className="font-bold text-text">{tenant._count?.aiAgents || 0}</p><p className="text-xs text-muted">Agentes</p></div>
              <div className="bg-bg rounded-lg p-3"><p className="font-bold text-text">{tenant._count?.conversations || 0}</p><p className="text-xs text-muted">Conversas</p></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
