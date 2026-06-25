import { useState, useEffect } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import {
  Shield, LayoutDashboard, Building2, CreditCard, Users, Palette,
  LogOut, Menu, X, Bot, ChevronDown
} from "lucide-react"
import { cn } from "@/src/lib/utils"

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "" },
  { icon: Building2, label: "Tenants", href: "tenants" },
  { icon: CreditCard, label: "Planos", href: "plans" },
  { icon: Users, label: "Usuários", href: "users" },
  { icon: Palette, label: "Whitelabel", href: "whitelabel" },
]

export default function SuperAdminLayout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("vendaora_user")
    const token = localStorage.getItem("vendaora_token")
    if (!stored || !token) {
      navigate("/auth")
      return
    }
    const parsed = JSON.parse(stored)
    if (!parsed.isSuperadmin) {
      navigate("/app/dashboard")
      return
    }
    setUser(parsed)
    setLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("vendaora_token")
    localStorage.removeItem("vendaora_user")
    navigate("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
            <Shield className="text-white w-5 h-5" />
          </div>
          <div>
            <span className="font-display font-bold text-lg text-text">SuperAdmin</span>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Vendaora 360</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.href === ""}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              isActive
                ? "bg-red-50 text-red-600 border border-red-100"
                : "text-muted hover:bg-bg hover:text-text"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-text">{user?.name}</p>
            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Superadmin</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-bg flex">
      <aside className="hidden lg:flex w-64 border-r border-border flex-col bg-surface fixed inset-y-0">
        <Sidebar />
      </aside>

      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 bg-surface z-50 border-r border-border shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-4 p-2 text-muted">
              <X className="w-5 h-5" />
            </button>
            <Sidebar />
          </aside>
        </>
      )}

      <main className="flex-1 lg:ml-64">
        <header className="h-16 border-b border-border flex items-center justify-between px-4 lg:px-8 bg-surface/80 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 text-muted hover:bg-bg rounded-lg" onClick={() => setMobileOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg">
              <Shield className="w-4 h-4 text-red-600" />
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Super Admin</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/app/dashboard")}
              className="flex items-center gap-2 text-sm text-muted hover:text-text transition-colors bg-bg border border-border rounded-xl px-4 py-2"
            >
              <Bot className="w-4 h-4" />
              Ir para o App
            </button>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
