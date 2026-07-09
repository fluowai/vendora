import { useState, useEffect } from "react"
import { Search, Building2, CheckCircle, XCircle, ExternalLink, ArrowLeft, LifeBuoy } from "lucide-react"
import { cn } from "@/src/lib/utils"
import { api } from "@/src/lib/api"
import { useNavigate } from "react-router-dom"

interface Tenant {
  id: string; name: string; slug: string; email: string; document: string
  phone: string; status: string; planId: string; branding: any
  createdAt: string; userCount: number; agentCount: number; conversationCount: number
}

export default function SuperAdminTenants() {
  const navigate = useNavigate()
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [editData, setEditData] = useState<any>({})

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem("vendaora_token")
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/superadmin/tenants?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) {
        setTenants(data.tenants)
        setTotalPages(data.pagination.totalPages)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTenants() }, [page, search])

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant)
    setEditData({
      name: tenant.name, slug: tenant.slug, email: tenant.email,
      document: tenant.document, phone: tenant.phone, status: tenant.status,
      planId: tenant.planId,
    })
  }

  const handleSave = async () => {
    if (!selectedTenant) return
    try {
      const token = localStorage.getItem("vendaora_token")
      const res = await fetch(`/api/superadmin/tenants/${selectedTenant.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      })
      if (res.ok) {
        setSelectedTenant(null)
        fetchTenants()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este tenant? Todas os dados associados serão perdidos.")) return
    try {
      const token = localStorage.getItem("vendaora_token")
      const res = await fetch(`/api/superadmin/tenants/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) fetchTenants()
    } catch (err) {
      console.error(err)
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Tenants</h1>
          <p className="text-sm text-muted mt-1">Gerencie todas as empresas da plataforma</p>
        </div>
      </div>

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
            {["name", "slug", "email", "document", "phone", "status", "planId"].map((field) => (
              <div key={field} className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">{field}</label>
                {field === "status" ? (
                  <select
                    value={editData[field] || ""}
                    onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="active">Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={editData[field] || ""}
                    onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={handleSave} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all">
              Salvar
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
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Empresa</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Plano</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Usuários</th>
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
                            <p className="text-xs text-muted">{tenant.email}</p>
                          </div>
                        </div>
                      </td>
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
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold capitalize">
                          {tenant.planId || "free"}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-text">{tenant.userCount}</td>
                      <td className="p-4 text-sm text-text">{tenant.agentCount}</td>
                      <td className="p-4 text-sm text-muted">{new Date(tenant.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(tenant)} className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all">
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleSupport(tenant)} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all" title="Prestar suporte">
                            <LifeBuoy className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(tenant.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                            <XCircle className="w-4 h-4" />
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
