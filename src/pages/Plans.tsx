import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  CheckCircle2, Sparkles, ArrowRight
} from "lucide-react"
import { cn } from "@/src/lib/utils"

const plans = [
  {
    id: 'free',
    name: 'Starter',
    price: 'Grátis',
    period: '/mês',
    description: 'Para começar com agentes de IA',
    features: [
      '1 agente de IA',
      '500 conversas/mês',
      '1 canal (Web Chat)',
      'Modelo Gemini Flash',
      'Relatórios básicos',
      'Comunidade',
    ],
    limitations: ['Sem marketplace', 'Sem integrações externas'],
    cta: 'Começar Grátis',
    highlighted: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 'R$ 97',
    period: '/mês',
    description: 'Para empresas em expansão',
    features: [
      '5 agentes de IA',
      '5.000 conversas/mês',
      'Todos os canais (WhatsApp, Instagram, Web)',
      'Modelos Gemini + GPT',
      'Marketplace de agentes',
      'Base de conhecimento (RAG)',
      'Analytics avançado',
      'Suporte prioritário',
    ],
    cta: 'Assinar Growth',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Professional',
    price: 'R$ 297',
    period: '/mês',
    description: 'Para operações em escala',
    features: [
      'Agentes ilimitados',
      '50.000 conversas/mês',
      'Todos os canais + API',
      'Todos os modelos (Gemini, GPT, Claude)',
      'Marketplace + Publicação',
      'Orquestrador multi-agente',
      'White-label',
      'Widget incorporável',
      'Integrações via Webhook',
      'SLA 99.9%',
      'Gerente de sucesso dedicado',
    ],
    cta: 'Assinar Pro',
    highlighted: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Sob consulta',
    period: '',
    description: 'Para grandes empresas e agências',
    features: [
      'Tudo do Pro +',
      'Conversas ilimitadas',
      'Infraestrutura dedicada',
      'Fine-tuning de modelos',
      'Agentes de voz',
      'Onboarding dedicado',
      'Contrato personalizado',
      'Treinamento da equipe',
    ],
    cta: 'Falar com Vendas',
    highlighted: false,
  },
]

const planosComparacao = [
  { feature: 'Agentes de IA', free: '1', growth: '5', pro: 'Ilimitados', enterprise: 'Ilimitados' },
  { feature: 'Conversas/mês', free: '500', growth: '5.000', pro: '50.000', enterprise: 'Ilimitadas' },
  { feature: 'Canais', free: '1', growth: '3', pro: 'Todos + API', enterprise: 'Todos + API' },
  { feature: 'Modelos LLM', free: 'Gemini Flash', growth: 'Gemini + GPT', pro: 'Gemini + GPT + Claude', enterprise: 'Todos + Fine-tuning' },
  { feature: 'Marketplace', free: '—', growth: 'Instalar', pro: 'Instalar + Publicar', enterprise: 'Instalar + Publicar' },
  { feature: 'Base Conhecimento', free: '—', growth: '✓', pro: '✓ Avançado', enterprise: '✓ + Curadoria' },
  { feature: 'Orquestrador', free: '—', growth: 'Básico', pro: 'Multi-agente', enterprise: 'Multi-agente + Workflows' },
  { feature: 'White-label', free: '—', growth: '—', pro: '✓', enterprise: '✓' },
  { feature: 'Widget / Embed', free: '—', growth: '✓', pro: '✓ + API', enterprise: '✓ Completo' },
  { feature: 'Analytics', free: 'Básico', growth: 'Avançado', pro: '360', enterprise: '360 + BI' },
]

export default function Plans() {
  const [annual, setAnnual] = useState(false)
  const navigate = useNavigate()

  function handlePlanAction(planId: string) {
    if (planId === "free") {
      navigate("/app/agents")
      return
    }
    if (planId === "enterprise") {
      navigate("/app/inbox?search=vendas")
      return
    }
    navigate(`/app/settings?plan=${planId}&billing=${annual ? "annual" : "monthly"}`)
  }

  return (
    <div className="space-y-10 pb-10">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/10 rounded-full mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Planos e Preços</span>
        </div>
        <h1 className="text-4xl font-display font-bold mb-4">Escolha o plano ideal</h1>
        <p className="text-muted text-lg">De startups a enterprises, temos o plano certo para sua máquina de agentes de IA.</p>
      </div>

      {/* Billing Toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm font-bold", !annual ? 'text-text' : 'text-muted')}>Mensal</span>
        <button
          onClick={() => setAnnual(!annual)}
          className={cn(
            "w-12 h-6 rounded-full transition-all relative border",
            annual ? 'bg-primary border-primary' : 'bg-bg border-border'
          )}
        >
          <div className={cn(
            "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow-sm border",
            annual ? 'translate-x-6' : 'translate-x-0.5'
          )} />
        </button>
        <span className={cn("text-sm font-bold", annual ? 'text-text' : 'text-muted')}>
          Anual <span className="text-primary text-[10px]">-20%</span>
        </span>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={cn(
              "relative rounded-[2.5rem] border p-8 flex flex-col transition-all",
              plan.highlighted
                ? 'bg-primary text-white border-primary shadow-2xl shadow-primary/20 scale-105'
                : 'bg-surface border-border hover:border-primary/30'
            )}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white text-primary rounded-full text-[9px] font-bold uppercase tracking-widest shadow-lg border border-primary/20">
                Mais Popular
              </div>
            )}

            <div className="mb-6">
              <h3 className={cn("text-xl font-display font-bold mb-1", plan.highlighted ? 'text-white' : 'text-text')}>
                {plan.name}
              </h3>
              <p className={cn("text-xs", plan.highlighted ? 'text-white/70' : 'text-muted')}>{plan.description}</p>
            </div>

            <div className="mb-8">
              <span className={cn("text-4xl font-display font-bold", plan.highlighted ? 'text-white' : 'text-text')}>{plan.price}</span>
              {plan.period && <span className={cn("text-sm ml-1", plan.highlighted ? 'text-white/60' : 'text-muted')}>{plan.period}</span>}
              {annual && plan.id !== 'free' && plan.id !== 'enterprise' && (
                <div className={cn("text-xs mt-1 font-bold", plan.highlighted ? 'text-white/70' : 'text-muted')}>
                  {(plan.id === 'growth' ? 'R$ 77' : 'R$ 237')}/mês (faturado anualmente)
                </div>
              )}
            </div>

            <button
              onClick={() => handlePlanAction(plan.id)}
              className={cn(
                "w-full py-3.5 rounded-xl text-xs font-bold transition-all mb-8 flex items-center justify-center gap-2",
                plan.highlighted
                  ? 'bg-white text-primary hover:bg-white/90'
                  : 'bg-primary text-white hover:bg-primary/90'
              )}
            >
              {plan.cta}
              <ArrowRight className="w-4 h-4" />
            </button>

            <ul className="space-y-3 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2 className={cn("w-4 h-4 mt-0.5 shrink-0", plan.highlighted ? 'text-white' : 'text-primary')} />
                  <span className={cn("text-xs", plan.highlighted ? 'text-white/90' : 'text-text')}>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="bg-surface rounded-[2.5rem] border border-border p-8">
        <h2 className="font-bold text-xl mb-8 text-center">Comparação Completa</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest pr-8">Funcionalidade</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest px-4">Starter</th>
                <th className="pb-4 text-[10px] font-bold text-primary uppercase tracking-widest px-4 bg-primary/5">Growth</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest px-4">Pro</th>
                <th className="pb-4 text-[10px] font-bold text-muted uppercase tracking-widest pl-4">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {planosComparacao.map((row) => (
                <tr key={row.feature}>
                  <td className="py-4 pr-8 text-sm font-bold">{row.feature}</td>
                  <td className="py-4 px-4 text-sm text-muted">{row.free}</td>
                  <td className="py-4 px-4 text-sm font-bold text-primary bg-primary/5">{row.growth}</td>
                  <td className="py-4 px-4 text-sm">{row.pro}</td>
                  <td className="py-4 pl-4 text-sm">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enterprise CTA */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-[2.5rem] border border-primary/20 p-10 text-center">
        <h2 className="text-2xl font-display font-bold mb-3">Precisa de uma solução personalizada?</h2>
        <p className="text-muted mb-6 max-w-xl mx-auto">Temos planos customizados para grandes volumes, agências white-label e integrações complexas.</p>
        <button onClick={() => handlePlanAction("enterprise")} className="px-8 py-4 bg-primary text-white rounded-2xl font-bold hover:bg-primary/90 transition-all inline-flex items-center gap-2">
          Falar com Consultor
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
