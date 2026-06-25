import { useState, useEffect } from "react"
import { Search, Users, Shield, CheckCircle, XCircle, ArrowLeft } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface SAUser {
  id: string; name: string; email: string; status: string
  isSuperadmin: boolean; lastLoginAt: string; createdAt: string
  tenantName: string; tenantSlug: string
}

export default function SuperAdminUsers() {
  const [users, setUsers] = useState<SAUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [editing, setEditing] = useState<SAUser | null>(null)
  const [editForm, setEditForm] = useState({ name: "", email: "", status: "", isSuperadmin: false, password: "" })

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("vendaora_token")
      const params = new URLSearchParams({ page: String(page), limit: "20" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/superadmin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) { setUsers(data.users); setTotalPages(data.pagination.totalPages) }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [page, search])

  const handleEdit = (user: SAUser) => {
    setEditing(user)
    setEditForm({ name: user.name, email: user.email, status: user.status, isSuperadmin: user.isSuperadmin, password: "" })
  }

  const handleSave = async () => {
    if (!editing) return
    try {
      const token = localStorage.getItem("vendaora_token")
      const body: any = { name: editForm.name, email: editForm.email, status: editForm.status, isSuperadmin: editForm.isSuperadmin }
      if (editForm.password) body.password = editForm.password
      const res = await fetch(`/api/superadmin/users/${editing.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) { setEditing(null); fetchUsers() }
    } catch (err) { console.error(err) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Usuários</h1>
        <p className="text-sm text-muted mt-1">Gerencie todos os usuários da plataforma</p>
      </div>

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
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Superadmin</label>
              <select value={String(editForm.isSuperadmin)} onChange={(e) => setEditForm({ ...editForm, isSuperadmin: e.target.value === "true" })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50">
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Nova Senha (deixe vazio para manter)</label>
              <input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-all">Salvar</button>
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
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Usuário</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Tenant</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Status</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Superadmin</th>
                    <th className="text-left p-4 text-[10px] font-bold text-muted uppercase tracking-widest">Último Login</th>
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
                            user.isSuperadmin ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary")}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-text">{user.name}</p>
                            <p className="text-xs text-muted">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-sm text-text">{user.tenantName}</td>
                      <td className="p-4">
                        <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                          user.status === "active" ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-500")}>
                          {user.status === "active" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {user.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {user.isSuperadmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-600 text-[10px] font-bold uppercase tracking-wider">
                            <Shield className="w-3 h-3" /> Sim
                          </span>
                        ) : <span className="text-sm text-muted">Não</span>}
                      </td>
                      <td className="p-4 text-sm text-muted">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("pt-BR") : "—"}</td>
                      <td className="p-4 text-sm text-muted">{new Date(user.createdAt).toLocaleDateString("pt-BR")}</td>
                      <td className="p-4">
                        <button onClick={() => handleEdit(user)}
                          className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all text-sm font-medium">
                          Editar
                        </button>
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
