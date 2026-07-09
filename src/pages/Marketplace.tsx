import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Store, TrendingUp, Sparkles, ArrowRight, Bot } from "lucide-react"
import { MarketplaceCard } from "@/src/components/marketplace/MarketplaceCard"
import { SegmentFilter } from "@/src/components/marketplace/SegmentFilter"
import { api } from "@/src/lib/api"

export default function Marketplace() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<any[]>([])
  const [featured, setFeatured] = useState<any[]>([])
  const [trending, setTrending] = useState<any[]>([])
  const [segments, setSegments] = useState<any[]>([])
  const [selectedSegment, setSelectedSegment] = useState('todos')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getMarketplaceAgents(),
      api.getMarketplaceFeatured(),
      api.getMarketplaceTrending(),
      api.getMarketplaceSegments(),
    ]).then(([all, feat, trend, segs]) => {
      setAgents(all.agents)
      setFeatured(feat.agents)
      setTrending(trend.agents)
      setSegments(segs.segments)
    }).finally(() => setLoading(false))
  }, [])

  const handleSegmentChange = async (seg: string) => {
    setSelectedSegment(seg)
    setLoading(true)
    const result = await api.getMarketplaceAgents(seg)
    setAgents(result.agents)
    setLoading(false)
  }

  const installAgent = async (id: string) => {
    const source = [...agents, ...featured, ...trending].find((agent) => agent.id === id)
    if (!source) return
    const created = await api.createAgent({
      name: source.name,
      description: source.description || "",
      segment: source.segment,
      status: "active",
      llmConfig: source.llmConfig || {
        provider: "gemini",
        model: "gemini-1.5-flash",
        temperature: 0.7,
        systemPrompt: source.description || `Voce e um agente especializado em ${source.segment}.`,
      },
      channels: source.channels || ["web"],
      tags: source.tags || [source.segment],
    })
    navigate(`/app/agents/${created.agent.id}`)
  }

  const viewAgent = (id: string) => navigate(`/app/agents/${id}`)

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Marketplace</span>
          </div>
          <h1 className="text-3xl font-display font-bold mb-1">Loja de Agentes</h1>
          <p className="text-muted">Descubra, instale e publique agentes de IA especializados para qualquer segmento.</p>
        </div>
      </div>

      {/* Featured Agents */}
      {featured.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Agentes em Destaque
            </h2>
            <button className="text-xs text-muted hover:text-primary flex items-center gap-1 font-medium">
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {featured.map((agent) => (
              <MarketplaceCard key={agent.id} agent={agent} onInstall={installAgent} onView={viewAgent} />
            ))}
          </div>
        </section>
      )}

      {/* Trending Agents */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Mais Instalados
            </h2>
            <button className="text-xs text-muted hover:text-primary flex items-center gap-1 font-medium">
              Ver todos <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {trending.map((agent) => (
              <MarketplaceCard key={agent.id} agent={agent} onInstall={installAgent} onView={viewAgent} />
            ))}
          </div>
        </section>
      )}

      {/* Segment Filter */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Explorar por Segmento</h2>
          <span className="text-[10px] text-muted">{agents.length} agentes disponíveis</span>
        </div>
        <SegmentFilter selected={selectedSegment} onSelect={handleSegmentChange} />
      </section>

      {/* Agents Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-surface rounded-[2rem] border border-border overflow-hidden animate-pulse">
              <div className="h-24 bg-muted/20" />
              <div className="p-5 space-y-3">
                <div className="h-4 bg-muted/20 rounded w-3/4" />
                <div className="h-3 bg-muted/20 rounded w-full" />
                <div className="h-3 bg-muted/20 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {agents.map((agent) => (
            <MarketplaceCard key={agent.id} agent={agent} onInstall={installAgent} onView={viewAgent} />
          ))}
        </div>
      )}

      {/* Segments Stats */}
      <section className="bg-surface rounded-[2.5rem] border border-border p-8">
        <h2 className="font-bold text-lg mb-6">Segmentos Disponíveis</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {segments.filter((s: any) => s.count > 0).map((seg: any) => (
            <button
              key={seg.id}
              onClick={() => handleSegmentChange(seg.id)}
              className="p-4 bg-bg rounded-2xl border border-border hover:border-primary/30 transition-all text-left"
            >
              <p className="text-2xl font-display font-bold text-primary mb-1">{seg.count}</p>
              <p className="text-xs text-muted font-medium">{seg.label}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
