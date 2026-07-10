import { useState, useEffect } from "react"
import { Search, Building2, CheckCircle, XCircle, ExternalLink, ArrowLeft, LifeBuoy, Plus, Trash2 } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/lib/api"
import { useNavigate } from "react-router-dom"

interface Tenant {
  id: string
  name: string
  slug: string
  email: string | null
  document: string | null
  phone: string | null
  status: string
  planId: string | null
  whiteLabelId?: string | null
  whiteLabelName?: string | null
  branding: any
  createdAt: string
  userCount: number
  agentCount: number
  conversationCount: number
}

interface Plan {
  id: string
  name: string
  isActive: boolean
}

interface WhiteLabelOption {
  id: string
  name: string
  slug: string
}

const emptyClientForm = {
  name: "",
  slug: "",
  email: "",
  document: "",
  phone: "",
  status: "active",
  planId: "growth",
  whiteLabelId: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

async function readApiJson<T = any>(res: Response): Promise<T> {
  const body = await res.text()
  if (!body.trim()) return {} as T
  try {
    return JSON.parse(body) as T
  } catch {
    const preview = body.trim().slice(0, 120).replace(/\s+/g, " ")
    throw new Error(`Resposta invalida da API (${res.status} ${res.statusText}): ${preview || "corpo vazio"}`)
  }
}

export default function SuperAdminTenants() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [whiteLabels, setWhiteLabels] = useState<WhiteLabelOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [editData, setEditData] = useState<any>({})
  const [showCreate, setShowCreate] = useState(false)
  const [createData, setCreateData] = useState(emptyClientForm)
  const [error, setError] = useState("")

  const token = () => localStorage.getItem("vendaora_token")

  const fetchTenants = async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/superadmin/tenants?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await readApiJson(res)
      if (res.ok) {
        setTenants(data.tenants)
        setTotalPages(data.pagination.totalPages)
      } else {
        setError(data.error || "Nao foi possivel carregar os clientes.")
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Erro ao carregar clientes.")
    } finally {
      setLoading(false)
    }
  }

  const fetchOptions = async () => {
    try {
      const [plansRes, whiteLabelsRes] = await Promise.all([
        fetch("/api/superadmin/plans", { headers: { Authorization: `Bearer ${token()}` } }),
        fetch("/api/superadmin/whitelabels?limit=100", { headers: { Authorization: `Bearer ${token()}` } }),
      ])
      const plansData = await readApiJson(plansRes)
      const whiteLabelsData = await readApiJson(whiteLabelsRes)
      if (plansRes.ok) setPlans(plansData.plans || [])
      if (whiteLabelsRes.ok) setWhiteLabels(whiteLabelsData.whiteLabels || [])
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => { fetchOptions() }, [])
  useEffect(() => { fetchTenants() }, [page, search])

  const planLabel = (planId?: string | null) => plans.find((plan) => plan.id === planId)?.name || planId || "Sem plano"

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setError("")
    setEditData({
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email || "",
      document: tenant.document || "",
      phone: tenant.phone || "",
      status: tenant.status,
      planId: tenant.planId || "",
      whiteLabelId: tenant.whiteLabelId || "",
    })
  }

  const handleSave = async () => {
    if (!selectedTenant) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/superadmin/tenants/${selectedTenant.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      })
      const data = await readApiJson(res).catch((err) => ({ error: err.message }))
      if (!res.ok) {
        setError(data.error || "Nao foi possivel salvar o cliente.")
        return
      }
      setSelectedTenant(null)
      fetchTenants()
    } catch (err) {
      console.error(err)
      setError("Erro ao salvar cliente.")
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!createData.name || !createData.slug) {
      setError("Informe nome e slug do cliente.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const payload: any = {
        name: createData.name,
        slug: createData.slug,
        email: createData.email,
        document: createData.document,
        phone: createData.phone,
        status: createData.status,
        planId: createData.planId || undefined,
        whiteLabelId: createData.whiteLabelId || undefined,
      }
      if (createData.adminEmail && createData.adminPassword) {
        payload.admin = {
          name: createData.adminName || "Admin",
          email: createData.adminEmail,
          password: createData.adminPassword,
        }
      }

      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await readApiJson(res).catch((err) => ({ error: err.message }))
      if (!res.ok) {
        setError(data.error || "Nao foi possivel criar o cliente.")
        return
      }
      setCreateData(emptyClientForm)
      setShowCreate(false)
      fetchTenants()
    } catch (err) {
      console.error(err)
      setError("Erro ao criar cliente.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tenant: Tenant) => {
    const ok = confirm(`Excluir definitivamente o cliente "${tenant.name}" e todos os dados vinculados? Esta acao nao pode ser desfeita.`)
    if (!ok) return
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant.id}?force=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await readApiJson(res).catch((err) => ({ error: err.message }))
      if (!res.ok) {
        alert(data.error || "Nao foi possivel excluir o cliente.")
        return
      }
      fetchTenants()
    } catch (err) {
      console.error(err)
      alert("Erro ao excluir cliente.")
    }
  }

  const handleSupport = async (tenant: Tenant) => {
    const megaToken = localStorage.getItem("vendaora_token")
    const megaUser = localStorage.getItem("vendaora_user")
    if (megaToken && megaUser) {
      localStorage.setItem("vendaora_mega_token", megaToken)
      localStorage.setItem("vendaora_mega_user", megaUser)
    }

    const session = await api.startTenantSupportSession(tenant.id)
    localStorage.setItem("vendaora_token", session.token)
    localStorage.setItem("vendaora_user", JSON.stringify(session.user))
    navigate("/app/dashboard")
  }

  const planOptions = plans.length > 0 ? plans : [{ id: "growth", name: "Growth", isActive: true }]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Clientes</h1>
          <p className="text-sm text-muted mt-1">Cadastre contas, associe revendas e defina planos</p>
        </div>
        <button onClick={() => { setShowCreate(true); setSelectedTenant(null); setError("") }} className="px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> Novo cliente
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">{error}</div>}

      {showCreate && (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-bold text-text">Novo cliente</h2>
            <button onClick={() => setShowCreate(false)} className="text-sm text-muted hover:text-text">Cancelar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Nome *</label>
              <input value={createData.name} onChange={(e) => setCreateData({ ...createData, name: e.target.value, slug: slugify(e.target.value) })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Slug *</label>
              <input value={createData.slug} onChange={(e) => setCreateData({ ...createData, slug: slugify(e.target.value) })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Email da conta</label>
              <input value={createData.email} onChange={(e) => setCreateData({ ...createData, email: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Documento</label>
              <input value={createData.document} onChange={(e) => setCreateData({ ...createData, document: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Telefone</label>
              <input value={createData.phone} onChange={(e) => setCreateData({ ...createData, phone: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Plano</label>
              <select value={createData.planId} onChange={(e) => setCreateData({ ...createData, planId: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                {planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Revenda</label>
              <select value={createData.whiteLabelId} onChange={(e) => setCreateData({ ...createData, whiteLabelId: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                <option value="">Direto / sem revenda</option>
                {whiteLabels.map((whiteLabel) => <option key={whiteLabel.id} value={whiteLabel.id}>{whiteLabel.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Admin inicial</label>
              <input value={createData.adminName} onChange={(e) => setCreateData({ ...createData, adminName: e.target.value })} placeholder="Nome" className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Email do admin</label>
              <input value={createData.adminEmail} onChange={(e) => setCreateData({ ...createData, adminEmail: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Senha inicial</label>
              <input type="password" value={createData.adminPassword} onChange={(e) => setCreateData({ ...createData, adminPassword: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-60 transition-all">
            {saving ? "Criando..." : "Criar cliente"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou slug..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full bg-surface border border-border rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : selectedTenant ? (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-6">
          <button onClick={() => setSelectedTenant(null)} className="flex items-center gap-2 text-sm text-muted hover:text-text transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="text-xl font-display font-bold text-text">Editar: {selectedTenant.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["name", "slug", "email", "document", "phone"].map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">{field}</label>
                <input
                  type="text"
                  value={editData[field] || ""}
                  onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Status</label>
              <select value={editData.status || "active"} onChange={(e) => setEditData({ ...editData, status: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Plano</label>
              <select value={editData.planId || ""} onChange={(e) => setEditData({ ...editData, planId: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                <option value="">Sem plano</option>
                {planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Revenda</label>
              <select value={editData.whiteLabelId || ""} onChange={(e) => setEditData({ ...editData, whiteLabelId: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                <option value="">Direto / sem revenda</option>
                {whiteLabels.map((whiteLabel) => <option key={whiteLabel.id} value={whiteLabel.id}>{whiteLabel.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-60 transition-all">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => setSelectedTenant(null)} className="px-6 py-3 bg-bg border border-border rounded-xl font-bold text-sm text-muted hover:text-text transition-all">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Cliente</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Revenda</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Plano</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Usuarios</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Agentes</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Criado em</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-bg/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-text">{tenant.name}</p>
                            <p className="text-xs text-muted">{tenant.email || tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-text">{tenant.whiteLabelName || "Direto"}</td>
                      <td className="p-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          tenant.status === "active" ? "bg-emerald-50 text-emerald-600" :
                          tenant.status === "suspended" ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-500"
                        )}>
                          {tenant.status === "active" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {tenant.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                          {planLabel(tenant.planId)}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-text">{tenant.userCount}</td>
                      <td className="p-4 text-sm text-text">{tenant.agentCount}</td>
                      <td className="p-4 text-sm text-muted">{new Date(tenant.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(tenant)} className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all" title="Editar">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleSupport(tenant)} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all" title="Prestar suporte">
                            <LifeBuoy className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(tenant)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Excluir cliente">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-sm font-bold transition-all",
                    page === i + 1 ? "bg-primary text-white" : "text-muted hover:bg-surface"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
