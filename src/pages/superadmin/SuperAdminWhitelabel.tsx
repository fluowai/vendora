import { useEffect, useState } from "react"
import { Building2, Globe, Plus, Search, Users } from "lucide-react"
import { api } from "@/src/lib/api"

export default function SuperAdminWhitelabel() {
  const [whiteLabels, setWhiteLabels] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    name: "",
    slug: "",
    email: "",
    customDomain: "",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
  })

  const load = () => api.getMegaWhiteLabels({ search }).then((res) => setWhiteLabels(res.whiteLabels))

  useEffect(() => { load() }, [search])

  const createWhiteLabel = async () => {
    if (!form.name || !form.slug) return
    setCreating(true)
    try {
      await api.createMegaWhiteLabel({
        name: form.name,
        slug: form.slug,
        email: form.email,
        customDomain: form.customDomain,
        planId: "enterprise",
        branding: {
          companyName: form.name,
          primaryColor: "#0f766e",
          secondaryColor: "#111827",
        },
        limits: {
          maxTenants: 50,
          maxUsers: 500,
          maxAgents: 500,
          maxConversations: 100000,
          maxCallMinutes: 50000,
        },
        owner: form.ownerEmail && form.ownerPassword ? {
          name: form.ownerName,
          email: form.ownerEmail,
          password: form.ownerPassword,
        } : undefined,
      })
      setForm({ name: "", slug: "", email: "", customDomain: "", ownerName: "", ownerEmail: "", ownerPassword: "" })
      await load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">White Labels</h1>
        <p className="text-sm text-muted mt-1">Parceiros que vendem a plataforma com marca propria</p>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do white label" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="slug-do-parceiro" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} placeholder="app.parceiro.com" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} placeholder="Nome do Super Admin" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="email do Super Admin" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
          <div className="flex gap-3">
            <input type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} placeholder="senha inicial" className="min-w-0 flex-1 bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
            <button onClick={createWhiteLabel} disabled={creating} className="px-4 py-3 bg-red-600 text-white rounded-lg font-bold text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Criar
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar white label..." className="w-full bg-surface border border-border rounded-lg py-3 pl-11 pr-4 text-sm outline-none" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {whiteLabels.map((whiteLabel) => (
          <div key={whiteLabel.id} className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-red-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-text truncate">{whiteLabel.name}</h2>
                  <p className="text-xs text-muted">{whiteLabel.slug}</p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase px-2 py-1 rounded bg-emerald-50 text-emerald-700">{whiteLabel.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="bg-bg rounded-lg p-3">
                <p className="font-bold text-text">{whiteLabel.tenantCount || 0}</p>
                <p className="text-xs text-muted">Clientes</p>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <p className="font-bold text-text">{whiteLabel.userCount || 0}</p>
                <p className="text-xs text-muted">Usuarios</p>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <p className="font-bold text-text">{whiteLabel.planName || whiteLabel.planId || "-"}</p>
                <p className="text-xs text-muted">Plano</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p className="text-muted flex items-center gap-2"><Globe className="w-4 h-4" />{whiteLabel.customDomain || "Dominio nao configurado"}</p>
              <p className="text-muted flex items-center gap-2"><Users className="w-4 h-4" />{whiteLabel.owner?.email || "Sem Super Admin definido"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
