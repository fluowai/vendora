import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  MessageSquare, 
  Trello, 
  Bot, 
  Megaphone, 
  Store,
  BarChart3,
  CreditCard,
  Settings, 
  LogOut,
  Bell,
  Search,
  Users,
  Ticket,
  ShieldAlert,
  Zap,
  Menu,
  X,
  Sparkles,
  Shield,
  Plug,
  CalendarDays
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect } from "react";

const navTop = [
  { icon: LayoutDashboard, label: "Dashboard 360", href: "dashboard" },
  { icon: MessageSquare, label: "Mensagens", href: "inbox" },
  { icon: Plug, label: "Conexões", href: "connections" },
  { icon: Users, label: "Contatos 360", href: "contacts" },
  { icon: Trello, label: "CRM Kanban", href: "crm" },
  { icon: Ticket, label: "Tickets", href: "tickets" },
  { icon: ShieldAlert, label: "Ouvidoria 360", href: "ombudsman" },
  { icon: Bot, label: "Agentes IA", href: "agents" },
  { icon: CalendarDays, label: "Agenda", href: "calendar" },
  { icon: Zap, label: "Automações", href: "automations" },
  { icon: Megaphone, label: "Campanhas", href: "campaigns" },
  { icon: Sparkles, label: "Marketplace", href: "marketplace" },
]

const navBottom = [
  { icon: BarChart3, label: "Analytics 360", href: "analytics" },
  { icon: CreditCard, label: "Planos", href: "plans" },
]

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    const stored = localStorage.getItem("vendaora_user")
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch {}
    }
  }, [location.pathname]);

  const SidebarContent = () => (
    <>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Bot className="text-white w-5 h-5" />
          </div>
          <span className="font-display font-bold text-xl text-text">Vendedora AI 360</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navTop.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-[#E8F6F0] text-primary border border-[#25D366]/10" 
                : "text-muted hover:bg-bg hover:text-text"
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted group-hover:text-text")} />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && <div className="absolute right-4 w-1.5 h-1.5 bg-primary rounded-full" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Nav */}
      <div className="px-4 py-2 space-y-1 border-t border-border pt-4">
        {navBottom.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-[#E8F6F0] text-primary border border-[#25D366]/10" 
                : "text-muted hover:bg-bg hover:text-text"
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted group-hover:text-text")} />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && <div className="absolute right-4 w-1.5 h-1.5 bg-primary rounded-full" />}
              </>
            )}
          </NavLink>
        ))}
        {user?.isSuperadmin && (
          <NavLink
            to="/superadmin"
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-red-50 text-red-600 border border-red-100" 
                : "text-muted hover:bg-red-50 hover:text-red-600"
            )}
          >
            <Shield className="w-5 h-5" />
            <span className="font-medium text-sm">Super Admin</span>
          </NavLink>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-1">
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted hover:bg-bg hover:text-text transition-all">
          <Settings className="w-5 h-5" />
          <span className="font-medium text-sm">Configurações</span>
        </button>
        <button 
          onClick={() => {
            localStorage.removeItem("vendaora_token");
            localStorage.removeItem("vendaora_user");
            navigate("/");
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-medium"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium text-sm">Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-bg text-text">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border flex-col bg-surface overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="lg:hidden fixed inset-y-0 left-0 w-[280px] bg-surface z-50 flex flex-col border-r border-border shadow-2xl overflow-y-auto"
            >
              <div className="absolute top-4 right-4 lg:hidden">
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-muted">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 lg:h-20 border-b border-border flex items-center justify-between px-4 lg:px-8 bg-surface/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-text hover:bg-bg rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center gap-4 bg-bg px-4 py-2 rounded-xl border border-border w-64 lg:w-96">
              <Search className="w-4 h-4 text-muted" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="bg-transparent border-none outline-none text-sm w-full"
              />
            </div>
            {/* Mobile Logo */}
            {!isMobileMenuOpen && (
              <div className="lg:hidden flex items-center gap-2">
                <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
                  <Bot className="text-white w-4 h-4" />
                </div>
                <span className="font-display font-bold text-lg text-text">Vendedora 360</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {user?.isSuperadmin && (
              <button onClick={() => navigate("/superadmin")} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-100 rounded-lg text-red-600 text-[10px] font-bold uppercase tracking-wider hover:bg-red-100 transition-all">
                <Shield className="w-3 h-3" /> Super Admin
              </button>
            )}
            <button className="p-2 lg:p-2.5 rounded-xl bg-bg border border-border text-muted hover:text-primary transition-all relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-surface shadow-sm" />
            </button>
            <div className="h-8 w-px bg-border mx-1 lg:mx-2" />
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold truncate max-w-[100px] text-text">{user?.name || "Empresa Demo"}</p>
                <div className="flex items-center gap-1 justify-end">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <p className="text-[10px] text-muted font-bold uppercase tracking-wider">Growth</p>
                </div>
              </div>
              <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm lg:text-base">
                {user?.name?.charAt(0)?.toUpperCase() || "V"}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Canvas */}
        <div className="flex-1 overflow-auto p-4 lg:p-6 xl:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="h-full max-w-[1600px] mx-auto"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
