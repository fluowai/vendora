import { 
  ArrowRight, 
  MessageSquare, 
  Bot, 
  Zap, 
  Trello, 
  CheckCircle2, 
  Users, 
  BarChart3,
  Globe,
  ShieldCheck,
  Menu,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 lg:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Bot className="text-white w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg lg:text-xl tracking-tight text-text">Vendaora AI</span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted hover:text-primary transition-colors">Recursos</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted hover:text-primary transition-colors">Como Funciona</a>
            <a href="#pricing" className="text-sm font-medium text-muted hover:text-primary transition-colors">Preços</a>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <Link to="/auth" className="hidden sm:block text-sm font-medium text-muted hover:text-primary transition-colors">Entrar</Link>
            <Link to="/app/dashboard" className="px-4 lg:px-5 py-2 lg:py-2.5 bg-primary text-white font-bold rounded-xl text-xs lg:text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20">
              Começar Grátis
            </Link>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-muted hover:text-text transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Content */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-0 z-[60] bg-white p-6"
          >
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Bot className="text-white w-5 h-5" />
                </div>
                <span className="font-display font-bold text-xl text-text">Vendaora AI</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-muted">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col gap-6 text-center">
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">Recursos</a>
              <a href="#how-it-works" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">Como Funciona</a>
              <a href="#pricing" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">Preços</a>
              <hr className="border-border" />
              <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">Entrar</Link>
              <Link to="/app/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="px-6 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 text-center">
                Começar Agora
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-32 lg:pt-40 pb-16 lg:pb-24 overflow-hidden bg-white">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 lg:px-6 relative">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full mb-6 lg:mb-8"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wider text-primary">Plataforma Oficial WhatsApp</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-7xl font-display font-bold tracking-tight mb-6 lg:mb-8 leading-[1.1] text-text px-2"
            >
              Transforme seu WhatsApp em uma <span className="text-primary">máquina de vendas</span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-base lg:text-xl text-muted mb-10 lg:mb-12 leading-relaxed max-w-2xl mx-auto"
            >
              Conecte sua empresa à API Oficial Meta. Use IA para atender 24h, 
              organize leads em um CRM visual e escale sua operação comercial.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
            >
              <Link to="/app/dashboard" className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-2 group hover:green-glow-soft shadow-xl shadow-primary/20 transition-all">
                Criar minha conta agora
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button className="w-full sm:w-auto px-8 py-4 bg-white border border-border rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-50 transition-all text-text">
                Ver demonstração
              </button>
            </motion.div>
          </div>

          {/* Dashboard Mockup - Hidden/Simplified on mobile */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-16 lg:mt-20 relative px-2 lg:px-0"
          >
            <div className="absolute inset-0 bg-primary/20 blur-[100px] pointer-events-none -z-10 rounded-3xl" />
            <div className="bg-surface border border-border rounded-[1.5rem] lg:rounded-[2.5rem] p-1.5 lg:p-2 shadow-2xl overflow-hidden aspect-[16/10] lg:aspect-video">
              <div className="bg-white rounded-[1.2rem] lg:rounded-[2.2rem] h-full w-full overflow-hidden flex flex-col border border-border">
                <div className="h-8 lg:h-12 border-b border-border flex items-center px-4 lg:px-6 gap-2 bg-[#F8FAFC]">
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-red-400" />
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-yellow-400" />
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white p-4 lg:p-8">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    <div className="col-span-2 h-24 lg:h-40 bg-[#F1F5F9] rounded-2xl lg:rounded-3xl p-4 lg:p-6">
                      <div className="w-1/3 h-4 lg:h-6 bg-primary/10 rounded-lg mb-4" />
                      <div className="w-full h-8 lg:h-12 bg-white rounded-xl" />
                    </div>
                    <div className="hidden lg:block h-40 bg-[#F1F5F9] rounded-3xl p-6" />
                  </div>
                  <div className="mt-4 lg:mt-6 h-32 lg:h-64 bg-[#F1F5F9] rounded-2xl lg:rounded-3xl" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 lg:py-24 border-y border-border bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 text-center">
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">+50%</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Taxa de Conversão</p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">24/7</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Atendimento Ativo</p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">-80%</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Tempo de Resposta</p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">+10k</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Empresas Escalam</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 lg:mb-20 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-display font-bold mb-6 italic text-text text-balance">Tudo que você precisa para escalar sua operação.</h2>
            <p className="text-muted text-base lg:text-lg">
              Substitua 5 ferramentas diferentes por uma única plataforma integrada desenhada para vender no WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <FeatureCard 
              icon={Bot} 
              title="Agentes de IA"
              description="Treine IAs com seu conhecimento para qualificar leads e fechar vendas 24h por dia."
            />
            <FeatureCard 
              icon={Trello} 
              title="CRM Kanban"
              description="Visualize seu funil de vendas e organize cada oportunidade de negócio com clareza."
            />
            <FeatureCard 
              icon={Zap} 
              title="Automação Total"
              description="Crie sequências de follow-up e réguas de relacionamento automáticas no WhatsApp."
            />
            <FeatureCard 
              icon={Globe} 
              title="Canais Oficiais"
              description="Conecte-se via WhatsApp Cloud API e Instagram Direct com segurança e estabilidade."
            />
            <FeatureCard 
              icon={MessageSquare} 
              title="Inbox Omnichannel"
              description="Uma única tela para gerenciar todas as conversas da sua equipe de forma centralizada."
            />
            <FeatureCard 
              icon={BarChart3} 
              title="Métricas Reais"
              description="Saiba exatamente quanto sua IA está vendendo e identifique gargalos no seu funil."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 lg:py-20 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Bot className="text-white w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-text">Vendaora AI</span>
          </div>
          
          <p className="text-muted text-sm px-4 text-center">© 2024 Vendaora AI. Plataforma Oficial WhatsApp API.</p>
          
          <div className="flex items-center gap-6">
            <a href="#" className="text-muted hover:text-primary transition-colors"><Globe className="w-5 h-5" /></a>
            <a href="#" className="text-muted hover:text-primary transition-colors font-bold text-sm tracking-tighter">APP</a>
            <a href="#" className="text-muted hover:text-primary transition-colors font-bold text-sm tracking-tighter">DOCS</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="p-8 rounded-[2rem] bg-surface border border-border hover:border-primary/20 transition-all group card-shadow">
      <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center mb-6 border border-primary/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="text-xl font-display font-bold mb-4 text-text">{title}</h3>
      <p className="text-muted leading-relaxed text-sm">{description}</p>
    </div>
  );
}
