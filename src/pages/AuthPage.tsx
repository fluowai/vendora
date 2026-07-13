import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bot, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from "lucide-react"

async function readAuthResponse(res: Response) {
  const text = await res.text()
  const contentType = res.headers.get("content-type") || ""

  if (contentType.includes("application/json") && text) {
    try {
      return JSON.parse(text)
    } catch {
      throw new Error("Resposta invalida do servidor de autenticacao")
    }
  }

  if (!res.ok) {
    const status = res.status ? `Erro ${res.status}` : "Erro"
    const statusText = res.statusText ? `: ${res.statusText}` : ""
    throw new Error(`${status}${statusText}. A API de autenticacao nao respondeu em JSON.`)
  }

  throw new Error("Resposta vazia do servidor de autenticacao")
}

export default function AuthPage() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("admin@vendaora.com")
  const [password, setPassword] = useState("admin123")
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register"
      const body = isLogin ? { email, password } : { email, password, name, company }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await readAuthResponse(res)
      if (!res.ok) throw new Error(data.error || "Erro na autenticação")

      localStorage.setItem("vendaora_token", data.token)
      localStorage.setItem("vendaora_user", JSON.stringify(data.user))
      if (data.user?.platformRole === "mega_admin" || data.user?.isSuperadmin) {
        navigate("/mega-admin")
      } else if (data.user?.roleScope === "whitelabel") {
        navigate("/whitelabel")
      } else {
        navigate("/app/dashboard")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <div className="hidden md:flex flex-1 bg-surface border-r border-border items-center justify-center p-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-primary/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="max-w-md relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Bot className="text-bg w-7 h-7" />
            </div>
            <span className="font-display font-bold text-3xl tracking-tight">Woo Tech IA</span>
          </div>
          <h1 className="text-4xl font-display font-bold mb-6 leading-tight">Máquina de Agentes de IA para qualquer segmento.</h1>
          <p className="text-muted text-lg mb-10">
            Crie, publique e orquestre agentes de IA especializados. Marketplace, multi-LLM e analytics 360.
          </p>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Marketplace com agentes por segmento
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Suporte a Gemini, GPT, Claude e Groq
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Orquestrador multi-agente + RAG
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 md:p-20">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-display font-bold mb-2">{isLogin ? "Entrar" : "Criar conta"}</h2>
            <p className="text-muted text-sm italic">
              {isLogin ? "Sua máquina de agentes te espera." : "Comece sua máquina de agentes agora."}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Nome</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-surface border border-border rounded-2xl py-3.5 px-4 text-sm outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Empresa</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Sua empresa"
                    className="w-full bg-surface border border-border rounded-2xl py-3.5 px-4 text-sm outline-none focus:border-primary/50 transition-all"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-surface border border-border rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none focus:border-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-surface border border-border rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none focus:border-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-bg font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-4 hover:scale-[1.02] shadow-lg shadow-primary/10 transition-all group disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? "Acessar Painel" : "Criar Conta"}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-muted">
            {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
            <button onClick={() => { setIsLogin(!isLogin); setError("") }} className="text-primary font-bold hover:underline bg-transparent border-none cursor-pointer">
              {isLogin ? "Crie agora." : "Faça login."}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
