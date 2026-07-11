import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  FileText,
  Gauge,
  GitBranch,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquare,
  MousePointer2,
  Phone,
  Plug,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { BrandLogo } from "./BrandLogo";
import { GlobalCallHandler } from "./calls/GlobalCallHandler";
import { cn } from "@/src/lib/utils";

const primaryNav = [
  { icon: Gauge, label: "Painel", href: "dashboard" },
  { icon: MessageSquare, label: "Conversas", href: "inbox" },
  { icon: Send, label: "Disparos", href: "campaigns" },
  { icon: Phone, label: "Disparos agendados", href: "calls" },
  { icon: CalendarDays, label: "Agendas", href: "calendar" },
  { icon: FileText, label: "Templates", href: "marketplace" },
  { icon: GitBranch, label: "Fluxos", href: "automations" },
  { icon: UserRoundCog, label: "Contatos", href: "contacts" },
  { icon: Users, label: "Clientes", href: "crm" },
  { icon: MousePointer2, label: "Rastreamento de leads", href: "analytics" },
];

const settingsNav = [
  { icon: Users, label: "Usuarios", href: "settings" },
  { icon: LayoutGrid, label: "Configuracao de setores", href: "settings" },
  { icon: Shield, label: "Configuracao de perfis", href: "settings" },
  { icon: ShieldCheck, label: "Configuracao de permissoes", href: "settings" },
  { icon: BarChart3, label: "Auditoria", href: "settings" },
];

function expireSession() {
  localStorage.removeItem("vendaora_token");
  localStorage.removeItem("vendaora_user");
  localStorage.removeItem("vendaora_mega_token");
  localStorage.removeItem("vendaora_mega_user");
}

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    setIsMobileMenuOpen(false);
    const stored = localStorage.getItem("vendaora_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if ((parsed.platformRole === "mega_admin" || parsed.isSuperadmin) && !parsed.supportMode) {
          navigate("/mega-admin");
          return;
        }
        setUser(parsed);
      } catch {}
    }

    const token = localStorage.getItem("vendaora_token");
    if (!token) return;

    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401 || res.status === 404) {
          expireSession();
          setUser(null);
          if (!location.pathname.startsWith("/auth")) navigate("/auth");
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (!data?.user) return;
        localStorage.setItem("vendaora_user", JSON.stringify(data.user));
        if ((data.user.platformRole === "mega_admin" || data.user.isSuperadmin) && !data.user.supportMode) {
          navigate("/mega-admin");
          return;
        }
        setUser(data.user);
      })
      .catch(() => {});
  }, [location.pathname, navigate]);

  const exitSupportMode = () => {
    const megaToken = localStorage.getItem("vendaora_mega_token");
    const megaUser = localStorage.getItem("vendaora_mega_user");
    if (megaToken && megaUser) {
      localStorage.setItem("vendaora_token", megaToken);
      localStorage.setItem("vendaora_user", megaUser);
      localStorage.removeItem("vendaora_mega_token");
      localStorage.removeItem("vendaora_mega_user");
    }
    navigate("/mega-admin");
  };

  const submitGlobalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = globalSearch.trim();
    navigate(query ? `/app/inbox?search=${encodeURIComponent(query)}` : "/app/inbox");
  };

  const navClass = (isActive: boolean) => cn(
    "group flex min-h-10 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
    isActive
      ? "bg-primary text-white shadow-[0_10px_22px_rgba(11,51,72,0.22)]"
      : "text-text/80 hover:bg-[#F4F8F8] hover:text-primary",
  );

  const SidebarContent = () => (
    <>
      <div className="px-5 pb-4 pt-5">
        <BrandLogo />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        <p className="px-4 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted">
          Navegacao principal
        </p>
        {primaryNav.map((item) => (
          <NavLink key={item.href} to={item.href} className={({ isActive }) => navClass(isActive)}>
            <item.icon className="h-4.5 w-4.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          className={cn(
            "mt-2 flex w-full min-h-10 items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
            location.pathname.includes("/settings") ? "bg-[#CFF4DF] text-[#14705B]" : "text-text/80 hover:bg-[#F4F8F8]",
          )}
        >
          <Settings className="h-4.5 w-4.5 shrink-0" />
          <span className="flex-1 truncate text-left">Configuracoes</span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", settingsOpen && "rotate-180")} />
        </button>
        {settingsOpen && (
          <div className="ml-6 mt-1 space-y-1 border-l border-border pl-3">
            {settingsNav.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                className={({ isActive }) => cn(
                  "flex min-h-9 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition-all",
                  isActive ? "bg-primary text-white" : "text-text/70 hover:bg-[#F4F8F8] hover:text-primary",
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        )}

        <NavLink to="connections" className={({ isActive }) => cn(navClass(isActive), "mt-3")}>
          <Plug className="h-4.5 w-4.5 shrink-0" />
          <span className="truncate">Perfil WhatsApp</span>
        </NavLink>
      </nav>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="rounded-xl bg-[#F6F8F8] px-4 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted">Plano atual</p>
          <p className="text-sm font-black text-text">Basico</p>
        </div>
        <button
          onClick={() => navigate("/app/dashboard")}
          className="flex w-full items-center gap-3 rounded-full bg-[#F6F8F8] px-4 py-2.5 text-sm font-bold text-text"
        >
          <Menu className="h-4 w-4" />
          Menu
        </button>
        <button
          onClick={() => {
            expireSession();
            navigate("/");
          }}
          className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-bg text-text">
      <GlobalCallHandler />

      <aside className="hidden w-[272px] shrink-0 flex-col border-r border-border bg-white lg:flex">
        <SidebarContent />
      </aside>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -290 }}
              animate={{ x: 0 }}
              exit={{ x: -290 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col border-r border-border bg-white shadow-2xl lg:hidden"
            >
              <button onClick={() => setIsMobileMenuOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-muted">
                <X className="h-5 w-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-white/78 px-4 backdrop-blur-md lg:h-16 lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="rounded-lg p-2 text-text hover:bg-bg lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="lg:hidden">
              <BrandLogo compact={false} textClassName="text-base" markClassName="h-8 w-8" />
            </div>
            <form onSubmit={submitGlobalSearch} className="hidden h-10 w-[360px] items-center gap-3 rounded-full border border-border bg-[#F8FBFB] px-4 md:flex">
              <Search className="h-4 w-4 text-muted" />
              <input
                value={globalSearch}
                onChange={(event) => setGlobalSearch(event.target.value)}
                placeholder="Buscar conversas, contatos..."
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </form>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            {user?.supportMode && (
              <button onClick={exitSupportMode} className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 sm:inline-flex">
                Suporte: {user.supportTenantName || user.company}
              </button>
            )}
            <button className="rounded-full border border-[#BFECE1] bg-[#F0FFFB] px-3 py-1.5 text-xs font-black text-primary">
              IA 1 mi
            </button>
            <button onClick={() => navigate("/app/inbox")} className="relative rounded-full p-2.5 text-amber-500 transition hover:bg-amber-50" title="Ver mensagens">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-secondary ring-2 ring-white" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-black text-primary">
              {user?.name?.charAt(0)?.toUpperCase() || "E"}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-6 xl:p-7">
          {user?.supportMode && (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-amber-900">Modo suporte ativo</p>
                <p className="text-xs text-amber-800">Voce esta acessando {user.supportTenantName || user.company} a partir do Mega Admin.</p>
              </div>
              <button onClick={exitSupportMode} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white">
                Voltar ao Mega Admin
              </button>
            </div>
          )}
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="mx-auto h-full max-w-[1680px]"
          >
            <Outlet />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
