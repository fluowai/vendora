import { useCallback, useEffect, useState } from "react"
import { Search, Shield, CheckCircle, XCircle, ArrowLeft, Plus, Trash2, UserRound } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface SAUser {
  id: string
  name: string
  email: string
  status: string
  isSuperadmin: boolean
  platformRole: string
  roleScope: string
  lastLoginAt: string | null
  createdAt: string
  tenantId: string
  tenantName: string
  tenantSlug: string
  whiteLabelName?: string | null
}

interface TenantOption {
  id: string
  name: string
  slug: string
  whiteLabelName?: string | null
}

const emptyCreateForm = {
  name: "",
  email: "",
  password: "",
  tenantId: "",
  status: "active",
  roleScope: "tenant",
  isSuperadmin: false,
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<SAUser[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editing, setEditing] = useState<SAUser | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState("")
  const [editForm, setEditForm] = useState({ name: "", email: "", status: "", isSuperadmin: false, roleScope: "tenant", password: "" })
  const [createForm, setCreateForm] = useState(emptyCreateForm)

  const token = () => localStorage.getItem("vendaora_token")

  const fetchUsers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/superadmin/users?${params}`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json()
      if (res.ok) { setUsers(data.users); setTotalPages(data.pagination.totalPages) }
    } catch {
      setError("Erro ao buscar usuarios.")
    } finally {
      setLoading(false)
    }
  }, [page, search])

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/superadmin/tenants?limit=100", {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json()
      if (res.ok) {
        setTenants(data.tenants || [])
        setCreateForm((current) => current.tenantId ? current : { ...current, tenantId: data.tenants?.[0]?.id || "" })
      }
    } catch {
      setError("Erro ao buscar clientes.")
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleEdit = (user: SAUser) => {
    setEditing(user)
    setShowCreate(false)
    setError("")
    setEditForm({
      name: user.name,
      email: user.email,
      status: user.status,
      isSuperadmin: user.isSuperadmin || user.platformRole === "mega_admin",
      roleScope: user.roleScope || "tenant",
      password: "",
    })
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setError("")
    try {
      const body: any = {
        name: editForm.name,
        email: editForm.email,
        status: editForm.status,
        isSuperadmin: editForm.isSuperadmin,
        platformRole: editForm.isSuperadmin ? "mega_admin" : "none",
        roleScope: editForm.isSuperadmin ? "platform" : editForm.roleScope,
      }
      if (editForm.password) body.password = editForm.password
      const res = await fetch(`/api/superadmin/users/${editing.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Nao foi possivel salvar o usuario.")
        return
      }
      setEditing(null)
      fetchUsers()
    } catch {
      setError("Erro ao salvar usuario.")
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password || !createForm.tenantId) {
      setError("Informe nome, email, senha e cliente.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const payload = {
        name: createForm.name,
        email: createForm.email,
        password: createForm.password,
        tenantId: createForm.tenantId,
        status: createForm.status,
        isSuperadmin: createForm.isSuperadmin,
        platformRole: createForm.isSuperadmin ? "mega_admin" : "none",
        roleScope: createForm.isSuperadmin ? "platform" : createForm.roleScope,
      }
      const res = await fetch("/api/superadmin/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Nao foi possivel criar o usuario.")
        return
      }
      setCreateForm({ ...emptyCreateForm, tenantId: tenants[0]?.id || "" })
      setShowCreate(false)
      fetchUsers()
    } catch {
      setError("Erro ao criar usuario.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (user: SAUser) => {
    const ok = confirm(`Excluir o usuario "${user.name}"? As atribuicoes dele serao liberadas e as sessoes serao revogadas.`)
    if (!ok) return
    try {
      const res = await fetch(`/api/superadmin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || "Nao foi possivel excluir o usuario.")
        return
      }
      fetchUsers()
    } catch {
      alert("Erro ao excluir usuario.")
    }
  }

  const typeLabel = (user: SAUser) => {
    if (user.isSuperadmin || user.platformRole === "mega_admin") return "Mega Admin"
    if (user.roleScope === "whitelabel") return "Revenda"
    return "Cliente"
  }

  const typeClass = (user: SAUser) => {
    if (user.isSuperadmin || user.platformRole === "mega_admin") return "bg-red-50 text-red-600"
    if (user.roleScope === "whitelabel") return "bg-amber-50 text-amber-700"
    return "bg-blue-50 text-blue-600"
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Usuarios</h1>
          <p className="text-sm text-muted mt-1">Gerencie usuarios de clientes, revendas e Mega Admin</p>
        </div>
        <button onClick={() => { setShowCreate(true); setEditing(null); setError("") }} className="px-4 py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" /> Novo usuario
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">{error}</div>}

      {showCreate && (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-bold text-text">Novo usuario</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Nome</label>
              <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Email</label>
              <input value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Senha inicial</label>
              <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Cliente / conta</label>
              <select value={createForm.tenantId} onChange={(e) => setCreateForm({ ...createForm, tenantId: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Perfil</label>
              <select
                value={createForm.isSuperadmin ? "platform" : createForm.roleScope}
                onChange={(e) => {
                  const value = e.target.value
                  setCreateForm({ ...createForm, roleScope: value === "platform" ? "platform" : value, isSuperadmin: value === "platform" })
                }}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50"
              >
                <option value="tenant">Usuario de cliente</option>
                <option value="whitelabel">Usuario de revenda</option>
                <option value="platform">Mega Admin</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Status</label>
              <select value={createForm.status} onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })} className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-60 transition-all">{saving ? "Criando..." : "Criar"}</button>
            <button onClick={() => setShowCreate(false)} className="px-6 py-3 bg-bg border border-border rounded-xl font-bold text-sm text-muted hover:text-text transition-all">Cancelar</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="text" placeholder="Buscar por nome ou email..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full bg-surface border border-border rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/50 transition-all" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : editing ? (
        <div className="bg-surface rounded-2xl border border-border p-6 space-y-4">
          <button onClick={() => setEditing(null)} className="flex items-center gap-2 text-sm text-muted hover:text-text">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h2 className="font-bold text-text">Editar: {editing.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["name", "email"].map((f) => (
              <div key={f} className="space-y-1.5">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">{f}</label>
                <input type="text" value={(editForm as any)[f]} onChange={(e) => setEditForm({ ...editForm, [f]: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Status</label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Perfil</label>
              <select
                value={editForm.isSuperadmin ? "platform" : editForm.roleScope}
                onChange={(e) => {
                  const value = e.target.value
                  setEditForm({ ...editForm, roleScope: value === "platform" ? "platform" : value, isSuperadmin: value === "platform" })
                }}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50"
              >
                <option value="tenant">Usuario de cliente</option>
                <option value="whitelabel">Usuario de revenda</option>
                <option value="platform">Mega Admin</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Nova senha</label>
              <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="Deixe vazio para manter"
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-60 transition-all">{saving ? "Salvando..." : "Salvar"}</button>
            <button onClick={() => setEditing(null)} className="px-6 py-3 bg-bg border border-border rounded-xl font-bold text-sm text-muted hover:text-text transition-all">Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Usuario</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Cliente</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Revenda</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Perfil</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Ultimo login</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Criado em</th>
                    <th className="p-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-bg/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold",
                            user.isSuperadmin || user.platformRole === "mega_admin" ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")}>
                            {user.name?.charAt(0)?.toUpperCase() || <UserRound className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-text">{user.name}</p>
                            <p className="text-xs text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-text">{user.tenantName}</td>
                      <td className="p-4 text-sm text-muted">{user.whiteLabelName || "Direto"}</td>
                      <td className="p-4">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider", typeClass(user))}>
                          {(user.isSuperadmin || user.platformRole === "mega_admin") && <Shield className="w-3 h-3" />}
                          {typeLabel(user)}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          user.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500")}>
                          {user.status === "active" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-muted">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "-"}</td>
                      <td className="p-4 text-sm text-muted">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEdit(user)}
                            className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all text-sm font-medium">
                            Editar
                          </button>
                          <button onClick={() => handleDelete(user)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Excluir usuario">
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
                <button key={i} onClick={() => setPage(i + 1)}
                  className={cn("w-8 h-8 rounded-lg text-sm font-bold transition-all",
                    page === i + 1 ? "bg-primary text-white" : "text-muted hover:bg-surface")}>
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
