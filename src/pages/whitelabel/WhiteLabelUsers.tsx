import { useEffect, useState } from "react"
import { Users } from "lucide-react"
import { api } from "@/src/lib/api"

export default function WhiteLabelUsers() {
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    api.getWhiteLabelUsers().then((res) => setUsers(res.users))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Usuarios</h1>
        <p className="text-sm text-muted mt-1">Equipe do white label e admins dos clientes vinculados</p>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-bg border-b border-border text-xs text-muted font-bold uppercase">
          <span className="col-span-4">Usuario</span>
          <span className="col-span-3">Escopo</span>
          <span className="col-span-3">Empresa</span>
          <span className="col-span-2">Status</span>
        </div>
        {users.map((user) => (
          <div key={user.id} className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-border last:border-0 items-center">
            <div className="col-span-4 flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-teal-700" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-text truncate">{user.name}</p>
                <p className="text-xs text-muted truncate">{user.email}</p>
              </div>
            </div>
            <span className="col-span-3 text-sm text-text">{user.roleScope}</span>
            <span className="col-span-3 text-sm text-muted truncate">{user.tenant?.name || "-"}</span>
            <span className="col-span-2 text-xs font-bold uppercase text-emerald-700">{user.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
