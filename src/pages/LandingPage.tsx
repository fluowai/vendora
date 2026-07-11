import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  GitBranch,
  Headphones,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { BrandLogo, ENGINE_ONE_NAME, ENGINE_TWO_NAME } from "@/src/components/BrandLogo";

const capabilities = [
  { icon: MessageSquare, title: "Atendimento WhatsApp", text: "Inbox operacional para equipe, IA e handoff humano sem trocar de tela." },
  { icon: PhoneCall, title: "Chamadas e discadora", text: "Ligue pelo WhatsApp, acompanhe tentativas e prepare campanhas automaticas." },
  { icon: Bot, title: "Agentes de IA", text: "Agentes treinados com sua base, prontos para qualificar e responder 24 horas." },
  { icon: GitBranch, title: "Fluxos visuais", text: "Automacoes com blocos para mensagens, perguntas, ferramentas e transferencia." },
  { icon: Headphones, title: "PABX e SIP", text: "Base preparada para ramais, filas, URA, SIP e Asterisk quando o trunk estiver conectado." },
  { icon: BarChart3, title: "Gestao e rastreio", text: "Leads, campanhas, eventos, auditoria e relatorios por canal em tempo real." },
];

const proof = [
  "Dois motores WhatsApp preservados: whatsmeow/WaCalls e WAHA+",
  "Fallback de chamada perdida para conversa com IA",
  "Campanhas com limites, agenda e historico de tentativa",
  "PABX com ramais, filas, URA e rotas no mesmo painel",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5FAFA] text-text">
      <nav className="fixed top-0 z-50 w-full border-b border-white/70 bg-white/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 lg:px-6">
          <BrandLogo />
          <div className="hidden items-center gap-8 lg:flex">
            <a href="#plataforma" className="text-sm font-semibold text-muted hover:text-primary">Plataforma</a>
            <a href="#voz" className="text-sm font-semibold text-muted hover:text-primary">Voz IA</a>
            <a href="#motores" className="text-sm font-semibold text-muted hover:text-primary">Motores</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden text-sm font-bold text-muted hover:text-primary sm:block">Entrar</Link>
            <Link to="/app/dashboard" className="rounded-full bg-primary px-5 py-2.5 text-sm font-black text-white shadow-[0_14px_28px_rgba(11,51,72,0.22)] transition hover:bg-primary-dark">
              Acessar painel
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative isolate min-h-[92vh] overflow-hidden pt-16">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#e9f6f7_0%,#f7fbfb_42%,#dff1ee_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-56 bg-[linear-gradient(180deg,rgba(245,250,250,0),#F5FAFA)]" />
        <div className="mx-auto grid min-h-[calc(92vh-4rem)] max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:px-6 lg:py-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl">
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#BFECE1] bg-white/75 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-4 w-4 text-secondary" />
              atendimento, WhatsApp e voz IA
            </span>
            <h1 className="font-display text-5xl font-black leading-[1.02] tracking-normal text-text md:text-6xl lg:text-7xl">
              Woo Tech IA
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted lg:text-xl">
              Uma operacao comercial completa para conversar, ligar, automatizar e rastrear leads com IA. O WhatsApp continua no centro, agora com voz, discadora e PABX preparados para escala.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/app/dashboard" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-black text-white shadow-[0_18px_34px_rgba(11,51,72,0.24)] transition hover:bg-primary-dark">
                Comecar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#voz" className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white px-7 py-4 text-sm font-black text-primary transition hover:border-primary/40">
                Ver voz IA
              </a>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="relative min-h-[520px]">
            <div className="absolute inset-0 rounded-[2rem] border border-white/80 bg-white/65 shadow-[0_30px_90px_rgba(11,51,72,0.16)] backdrop-blur" />
            <div className="absolute left-5 top-5 right-5 rounded-2xl border border-border bg-white p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="section-eyebrow">operacao ao vivo</p>
                  <h2 className="mt-1 text-xl font-black">Central de conversas e chamadas</h2>
                </div>
                <span className="rounded-full bg-[#F0FFFB] px-3 py-1 text-xs font-black text-primary">IA 1 mi</span>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-3">
                {["Conversas", "Chamadas", "Atendidas", "Perdidas"].map((label, index) => (
                  <div key={label} className="rounded-xl border border-border bg-[#F8FBFB] p-3">
                    <p className="text-2xl font-black">{index === 0 ? "128" : index === 1 ? "42" : index === 2 ? "31" : "3"}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute bottom-7 left-7 right-7 grid gap-5 lg:grid-cols-[1fr_260px]">
              <div className="rounded-2xl border border-border bg-white p-5">
                <p className="section-eyebrow">fluxo de automacao</p>
                <div className="mt-5 grid grid-cols-3 items-center gap-3">
                  {["Entrada WhatsApp", "Agente IA", "Ligacao automatica"].map((item, index) => (
                    <div key={item} className="relative rounded-xl border border-border bg-[#F8FBFB] p-4">
                      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                        {index === 0 ? <MessageSquare className="h-4 w-4" /> : index === 1 ? <Bot className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                      </div>
                      <p className="text-sm font-black">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-primary p-5 text-white shadow-[0_20px_44px_rgba(11,51,72,0.28)]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/65">discador</p>
                <p className="mt-3 text-3xl font-black">00:50</p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
                    <span key={digit} className="flex h-10 items-center justify-center rounded-full bg-white/12 text-sm font-black">{digit}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary">
                    <PhoneCall className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-bold text-white/75">Chamada ativa via WooTech</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="plataforma" className="mx-auto max-w-7xl px-4 py-20 lg:px-6">
        <div className="mb-12 max-w-2xl">
          <p className="section-eyebrow">suite completa</p>
          <h2 className="mt-3 text-3xl font-black lg:text-5xl">Tudo no mesmo painel operacional</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#E7F7F1] text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="voz" className="border-y border-border bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[0.85fr_1.15fr] lg:px-6">
          <div>
            <p className="section-eyebrow">voz, PABX e discadora</p>
            <h2 className="mt-3 text-3xl font-black lg:text-5xl">Ligacoes automaticas sem abandonar o WhatsApp</h2>
            <p className="mt-5 text-base leading-7 text-muted">
              A Woo Tech IA usa a base WaCalls/WAHA+ para chamadas WhatsApp e prepara a camada SIP/Asterisk para telefonia tradicional, ramais e filas.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {proof.map((item) => (
              <div key={item} className="flex gap-3 rounded-xl border border-border bg-[#F8FBFB] p-4 text-sm font-bold">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="motores" className="mx-auto max-w-7xl px-4 py-20 lg:px-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <EngineCard
            title={ENGINE_ONE_NAME}
            subtitle="whatsmeow + WaCalls"
            text="Motor principal para mensagens WhatsApp e chamadas via WaCalls, mantendo a biblioteca atual e os recursos ja integrados."
          />
          <EngineCard
            title={ENGINE_TWO_NAME}
            subtitle="WAHA+"
            text="Motor paralelo para sessoes WAHA+, mensagens e chamadas WebRTC, preservado como segunda rota operacional."
          />
        </div>
      </section>

      <footer className="border-t border-border bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 px-4 text-center sm:flex-row sm:text-left lg:px-6">
          <BrandLogo />
          <p className="text-sm font-semibold text-muted">Woo Tech IA. Atendimento, WhatsApp, chamadas e agentes de IA.</p>
          <Link to="/auth" className="text-sm font-black text-primary">Entrar</Link>
        </div>
      </footer>
    </div>
  );
}

function EngineCard({ title, subtitle, text }: { title: string; subtitle: string; text: string }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-7 shadow-sm">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
        <Zap className="h-5 w-5" />
      </div>
      <p className="section-eyebrow">{subtitle}</p>
      <h3 className="mt-2 text-2xl font-black">{title}</h3>
      <p className="mt-4 text-sm leading-6 text-muted">{text}</p>
      <div className="mt-6 flex items-center gap-2 text-sm font-black text-primary">
        <ShieldCheck className="h-4 w-4" />
        Mantido com nome da marca
      </div>
    </div>
  );
}
