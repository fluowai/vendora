import {
  Phone, PhoneCall, Headphones, MessageSquare, Users, BarChart3,
  ArrowRight, CheckCircle2, Menu, X, Zap, ShieldCheck, Sliders,
  Timer, Voicemail, LineChart, Globe, Bot, ChevronDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

const features = [
  {
    icon: PhoneCall,
    title: "Transferência de Ramais",
    desc: "Possibilidade de transferir ramais mesmo durante uma ligação, proporcionando flexibilidade e agilidade no atendimento.",
  },
  {
    icon: Sliders,
    title: "Configuração Personalizada",
    desc: "Configure quantos ramais forem necessários e em qualquer localização, permitindo uma comunicação integrada entre filiais.",
  },
  {
    icon: Zap,
    title: "Baixo Custo",
    desc: "Implementação e manutenção com custos acessíveis, proporcionando uma solução econômica para sua necessidade telefônica.",
  },
  {
    icon: Voicemail,
    title: "URA Inteligente",
    desc: "Configure uma URA receptiva personalizada para automatizar e direcionar as chamadas e melhore a eficiência do atendimento.",
  },
  {
    icon: Timer,
    title: "Monitoramento em Tempo Real",
    desc: "Acompanhe chamadas em tempo real para supervisão e treinamento da equipe de atendimento.",
  },
  {
    icon: Users,
    title: "Filas de Atendimento",
    desc: "Implemente filas de atendimento para garantir que nenhuma chamada seja perdida e aumente a satisfação do cliente.",
  },
];

const faqItems = [
  {
    q: "Qual a diferença entre PABX Virtual e PABX Físico?",
    a: "O PABX físico exige a instalação de centrais telefônicas e cabeamento interno, gerando custos de manutenção e limitações de expansão. Já o PABX Virtual elimina a necessidade de infraestrutura física, oferece ramais ilimitados e permite configurações rápidas com integração a outros sistemas.",
  },
  {
    q: "É seguro usar um PABX Virtual?",
    a: "Sim. Utilizamos recursos avançados de segurança, como criptografia de chamadas e autenticação de usuários, garantindo a proteção dos dados e da comunicação da sua empresa.",
  },
  {
    q: "Como funciona a instalação do PABX Vendaora?",
    a: "A instalação é simples e rápida. Como não exige centrais físicas, sua empresa precisa apenas de dispositivos com acesso à internet. A configuração ocorre por meio de uma interface intuitiva.",
  },
  {
    q: "Quais são as opções de toque disponíveis?",
    a: "Oferecemos duas opções: Toque Simultâneo (todos os ramais tocam ao mesmo tempo) e Toque Sequencial (os ramais tocam um após o outro em ordem pré-definida).",
  },
];

export default function PabxLandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-gray-100 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 lg:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <PhoneCall className="text-white w-5 h-5" />
            </div>
            <span className="font-display font-bold text-lg lg:text-xl tracking-tight text-text">Vendaora PABX</span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted hover:text-primary transition-colors">Recursos</a>
            <a href="#diferenciais" className="text-sm font-medium text-muted hover:text-primary transition-colors">Diferenciais</a>
            <a href="#faq" className="text-sm font-medium text-muted hover:text-primary transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <Link to="/auth" className="hidden sm:block text-sm font-medium text-muted hover:text-primary transition-colors">Entrar</Link>
            <a href="#contato" className="px-4 lg:px-5 py-2 lg:py-2.5 bg-primary text-white font-bold rounded-xl text-xs lg:text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20">
              Fale com Especialista
            </a>
            <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 text-muted hover:text-text transition-colors">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="lg:hidden fixed inset-0 z-[60] bg-white p-6">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <PhoneCall className="text-white w-5 h-5" />
                </div>
                <span className="font-display font-bold text-xl text-text">Vendaora PABX</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-muted">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex flex-col gap-6 text-center">
              <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">Recursos</a>
              <a href="#diferenciais" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">Diferenciais</a>
              <a href="#faq" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">FAQ</a>
              <hr className="border-gray-100" />
              <Link to="/auth" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-bold text-text">Entrar</Link>
              <a href="#contato" onClick={() => setIsMobileMenuOpen(false)} className="px-6 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl shadow-primary/20 text-center">
                Fale com Especialista
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero */}
      <section className="relative pt-32 lg:pt-40 pb-16 lg:pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 lg:px-6 relative">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full mb-6 lg:mb-8"
            >
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-[10px] lg:text-xs font-bold uppercase tracking-wider text-primary">PABX em Nuvem</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-7xl font-display font-bold tracking-tight mb-6 lg:mb-8 leading-[1.1] text-text"
            >
              Centralize a comunicação, reduza custos com telefonia em até <span className="text-primary">53%</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="text-base lg:text-xl text-muted mb-10 lg:mb-12 leading-relaxed max-w-2xl mx-auto"
            >
              Crie ramais ilimitados, configure URA personalizada e integre suas chamadas WhatsApp com o PABX em nuvem mais completo do mercado.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <a href="#contato" className="w-full sm:w-auto px-8 py-4 bg-primary text-white font-bold rounded-2xl flex items-center justify-center gap-2 group hover:green-glow-soft shadow-xl shadow-primary/20 transition-all">
                Fale com um especialista
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#features" className="w-full sm:w-auto px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all text-text">
                Ver recursos
              </a>
            </motion.div>
          </div>

          {/* Dashboard Mockup */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}
            className="mt-16 lg:mt-20 relative"
          >
            <div className="absolute inset-0 bg-primary/20 blur-[100px] pointer-events-none -z-10 rounded-3xl" />
            <div className="bg-gray-100 border border-gray-200 rounded-[1.5rem] lg:rounded-[2.5rem] p-1.5 lg:p-2 shadow-2xl overflow-hidden aspect-[16/10] lg:aspect-video">
              <div className="bg-white rounded-[1.2rem] lg:rounded-[2.2rem] h-full w-full overflow-hidden flex flex-col border border-gray-100">
                <div className="h-8 lg:h-12 border-b border-gray-100 flex items-center px-4 lg:px-6 gap-2 bg-gray-50">
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-red-400" />
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-yellow-400" />
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 bg-white p-4 lg:p-8">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                    <div className="col-span-2 h-24 lg:h-40 bg-gray-50 rounded-2xl lg:rounded-3xl p-4 lg:p-6">
                      <div className="w-1/3 h-4 lg:h-6 bg-primary/10 rounded-lg mb-4" />
                      <div className="flex gap-4">
                        <div className="flex-1 h-8 lg:h-12 bg-white rounded-xl border border-gray-100" />
                        <div className="flex-1 h-8 lg:h-12 bg-white rounded-xl border border-gray-100" />
                      </div>
                    </div>
                    <div className="hidden lg:block h-40 bg-gray-50 rounded-3xl p-6">
                      <div className="w-full h-4 bg-primary/10 rounded-lg mb-3" />
                      <div className="w-2/3 h-4 bg-gray-200 rounded-lg" />
                    </div>
                  </div>
                  <div className="mt-4 lg:mt-6 h-32 lg:h-64 bg-gray-50 rounded-2xl lg:rounded-3xl flex items-center justify-center">
                    <div className="text-center">
                      <div className="grid grid-cols-4 gap-8 px-8">
                        {["Ramais", "Filas", "URA", "Rotas"].map(label => (
                          <div key={label} className="text-center">
                            <div className="w-8 h-8 lg:w-12 lg:h-12 bg-primary/10 rounded-xl mx-auto mb-2 flex items-center justify-center">
                              <Phone className="w-4 h-4 lg:w-6 lg:h-6 text-primary" />
                            </div>
                            <span className="text-xs text-muted font-medium">{label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 lg:py-24 border-y border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12 text-center">
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">+435 mi</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Ligações Realizadas</p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">+1,7 mil</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Clientes Ativos</p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">+18,6 mil</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Usuários Ativos</p>
            </div>
            <div>
              <p className="text-3xl lg:text-4xl font-display font-bold text-primary mb-2">-53%</p>
              <p className="text-muted text-[10px] lg:text-sm uppercase tracking-widest font-semibold">Redução de Custos</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-16 lg:mb-20 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl lg:text-4xl font-display font-bold mb-6 text-text">Vantagens do PABX Vendaora</h2>
            <p className="text-muted text-base lg:text-lg">
              Tudo que sua empresa precisa para centralizar a comunicação telefônica com eficiência e economia.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="p-8 rounded-[2rem] bg-white border border-gray-100 hover:border-primary/20 transition-all group card-shadow"
              >
                <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center mb-6 border border-primary/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold mb-4 text-text">{f.title}</h3>
                <p className="text-muted leading-relaxed text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciais */}
      <section id="diferenciais" className="py-24 lg:py-32 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-display font-bold mb-6 text-text">Modos de Toque</h2>
            <p className="text-muted text-base lg:text-lg">Flexibilidade total para escolher como as chamadas são distribuídas na sua equipe.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 lg:p-10 card-shadow">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 border border-blue-100">
                <PhoneCall className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-4 text-text">Toque Simultâneo</h3>
              <p className="text-muted mb-6">Todos os ramais designados tocam ao mesmo tempo quando uma chamada é recebida. Ideal para equipes pequenas onde qualquer membro pode atender rapidamente.</p>
              <ul className="space-y-3">
                {["Resposta mais rápida", "Ideal para equipes enxutas", "Melhor experiência para o cliente"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-text">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white border border-gray-100 rounded-[2rem] p-8 lg:p-10 card-shadow">
              <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mb-6 border border-purple-100">
                <Timer className="w-7 h-7 text-purple-600" />
              </div>
              <h3 className="text-2xl font-display font-bold mb-4 text-text">Toque Sequencial</h3>
              <p className="text-muted mb-6">Os ramais designados tocam um após o outro, em ordem pré-definida. Garante que a chamada seja oferecida a diferentes membros da equipe de forma ordenada.</p>
              <ul className="space-y-3">
                {["Distribuição equilibrada", "Tempo de resposta justo", "Priorização por hierarquia"].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-text">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="contato" className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-br from-primary via-primary-dark to-primary rounded-[2.5rem] p-10 lg:p-16 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <h2 className="text-3xl lg:text-5xl font-display font-bold text-white mb-6">
                Agende uma demonstração gratuita
              </h2>
              <p className="text-white/80 text-base lg:text-lg max-w-xl mx-auto mb-10">
                Descubra como o PABX Vendaora pode transformar a comunicação da sua empresa com nossa plataforma completa.
              </p>
              <a href="#" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-text font-bold rounded-2xl hover:scale-105 transition-all shadow-xl">
                Falar com Especialista
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 lg:py-32 bg-gray-50 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-display font-bold mb-6 text-text">Perguntas Frequentes</h2>
            <p className="text-muted">Tire suas dúvidas sobre o PABX em Nuvem Vendaora.</p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl overflow-hidden card-shadow">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-5 lg:p-6 text-left">
                  <span className="font-bold text-text text-sm lg:text-base pr-4">{item.q}</span>
                  <ChevronDown className={`w-5 h-5 text-muted flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      <p className="px-5 lg:px-6 pb-5 lg:pb-6 text-muted text-sm leading-relaxed">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 lg:py-20 border-t border-gray-100 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <PhoneCall className="text-white w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight text-text">Vendaora PABX</span>
          </div>
          <p className="text-muted text-sm text-center">2025 Vendaora. PABX em Nuvem — Todos os direitos reservados.</p>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-muted hover:text-primary transition-colors text-sm font-medium">Vendaora AI</Link>
            <Link to="/auth" className="text-muted hover:text-primary transition-colors text-sm font-medium">Entrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
