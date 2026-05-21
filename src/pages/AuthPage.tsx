import { useNavigate } from "react-router-dom";
import { Bot, Mail, Lock, Github, Chrome, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

export default function AuthPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      {/* Left side: Branding/Visual */}
      <div className="hidden md:flex flex-1 bg-surface border-r border-border items-center justify-center p-20 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-primary/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2" />
        
        <div className="max-w-md relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <Bot className="text-bg w-7 h-7" />
            </div>
            <span className="font-display font-bold text-3xl tracking-tight">Vendaora AI</span>
          </div>
          
          <h1 className="text-4xl font-display font-bold mb-6 leading-tight">A plataforma definitiva para escala comercial.</h1>
          <p className="text-muted text-lg mb-10">
            Junte-se a mais de 2.000 empresas que transformaram o WhatsApp em uma central de vendas inteligente.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Agentes de IA treinados com sua base
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              CRM Kanban integrado às conversas
            </div>
            <div className="flex items-center gap-4 text-sm text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              Campanhas oficiais da Meta
            </div>
          </div>
        </div>
      </div>

      {/* Right side: Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-20">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-display font-bold mb-2">Entrar na plataforma</h2>
            <p className="text-muted text-sm italic">Sua máquina de vendas está te esperando.</p>
          </div>

          <div className="space-y-4">
            <button className="w-full flex items-center justify-center gap-3 bg-white text-bg font-bold py-3.5 rounded-2xl hover:bg-neutral-200 transition-all">
              <Chrome className="w-5 h-5" />
              Entrar com Google
            </button>
            <button className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-bold py-3.5 rounded-2xl hover:bg-white/10 transition-all">
              <Github className="w-5 h-5" />
              Github
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-bg px-4 text-muted font-bold tracking-widest">Ou email</span></div>
          </div>

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); navigate("/app/dashboard"); }}>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted uppercase tracking-widest pl-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input 
                  type="email" 
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
                  placeholder="••••••••"
                  className="w-full bg-surface border border-border rounded-2xl py-3.5 pl-12 pr-4 text-sm outline-none focus:border-primary/50 transition-all"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-primary text-bg font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-4 hover:scale-[1.02] shadow-lg shadow-primary/10 transition-all group"
            >
              Acessar Painel
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <p className="text-center text-xs text-muted">
            Ainda não tem conta? <a href="#" className="text-primary font-bold hover:underline">Solicite acesso agora.</a>
          </p>
        </div>
      </div>
    </div>
  );
}
