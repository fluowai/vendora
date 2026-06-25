import { useState, useEffect } from "react"
import { Palette, Building2, Save, Search } from "lucide-react"
import { cn } from "@/src/lib/utils"

interface Tenant {
  id: string; name: string; slug: string; branding: any
}

export default function SuperAdminWhitelabel() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)
  const [branding, setBranding] = useState({
    logoUrl: "", primaryColor: "#25D366", secondaryColor: "#128C7E",
    companyName: "", customDomain: "", faviconUrl: "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchTenants = async () => {
    try {
      const token = localStorage.getItem("vendaora_token")
      const params = new URLSearchParams({ limit: "100" })
      if (search) params.set("search", search)
      const res = await fetch(`/api/superadmin/tenants?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (res.ok) setTenants(data.tenants)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTenants() }, [search])

  const selectTenant = (t: Tenant) => {
    setSelectedTenant(t)
    const b = t.branding || {}
    setBranding({
      logoUrl: b.logoUrl || "", primaryColor: b.primaryColor || "#25D366",
      secondaryColor: b.secondaryColor || "#128C7E", companyName: b.companyName || t.name,
      customDomain: b.customDomain || "", faviconUrl: b.faviconUrl || "",
    })
    setSaved(false)
  }

  const handleSave = async () => {
    if (!selectedTenant) return
    setSaving(true)
    try {
      const token = localStorage.getItem("vendaora_token")
      const res = await fetch(`/api/superadmin/tenants/${selectedTenant.id}/branding`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Whitelabel</h1>
        <p className="text-sm text-muted mt-1">Personalize a identidade visual de cada tenant</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
        <input type="text" placeholder="Buscar tenant..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-border rounded-xl py-3 pl-11 pr-4 text-sm outline-none focus:border-primary/50" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto">
            {tenants.map((t) => (
              <button key={t.id} onClick={() => selectTenant(t)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
                  selectedTenant?.id === t.id
                    ? "bg-primary/5 border-primary/30"
                    : "bg-surface border-border hover:border-primary/20"
                )}>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm text-text">{t.name}</p>
                  <p className="text-xs text-muted">{t.slug}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {selectedTenant ? (
              <div className="bg-surface rounded-2xl border border-border p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-text">{selectedTenant.name}</h2>
                  <button onClick={handleSave} disabled={saving}
                    className={cn(
                      "px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all",
                      saved ? "bg-emerald-500 text-white" : "bg-primary text-white hover:bg-primary/90"
                    )}>
                    <Save className="w-4 h-4" />
                    {saving ? "Salvando..." : saved ? "Salvo!" : "Salvar"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Nome da Empresa</label>
                    <input type="text" value={branding.companyName}
                      onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                      className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Domínio Personalizado</label>
                    <input type="text" value={branding.customDomain} placeholder="ex: empresa.meudominio.com"
                      onChange={(e) => setBranding({ ...branding, customDomain: e.target.value })}
                      className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">URL do Logo</label>
                    <input type="text" value={branding.logoUrl}
                      onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                      className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">URL do Favicon</label>
                    <input type="text" value={branding.faviconUrl}
                      onChange={(e) => setBranding({ ...branding, faviconUrl: e.target.value })}
                      className="w-full bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Cor Primária</label>
                    <div className="flex gap-2">
                      <input type="color" value={branding.primaryColor}
                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                        className="w-12 h-12 rounded-xl border border-border cursor-pointer" />
                      <input type="text" value={branding.primaryColor}
                        onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                        className="flex-1 bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50 font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase tracking-wider">Cor Secundária</label>
                    <div className="flex gap-2">
                      <input type="color" value={branding.secondaryColor}
                        onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                        className="w-12 h-12 rounded-xl border border-border cursor-pointer" />
                      <input type="text" value={branding.secondaryColor}
                        onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                        className="flex-1 bg-bg border border-border rounded-xl py-3 px-4 text-sm outline-none focus:border-primary/50 font-mono" />
                    </div>
                  </div>
                </div>

                <div className="bg-bg rounded-2xl border border-border p-6">
                  <h3 className="font-bold text-text mb-4">Preview</h3>
                  <div className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: branding.primaryColor + "10", borderColor: branding.primaryColor + "30", border: "1px solid" }}>
                    {branding.logoUrl ? (
                      <img src={branding.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: branding.primaryColor }}>
                        {branding.companyName?.charAt(0) || "V"}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-text">{branding.companyName || selectedTenant.name}</p>
                      <p className="text-xs text-muted">Powered by Vendaora 360</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface rounded-2xl border border-border p-20 text-center">
                <Palette className="w-12 h-12 text-muted mx-auto mb-4" />
                <p className="text-muted font-medium">Selecione um tenant ao lado para configurar o whitelabel</p>
                <p className="text-xs text-muted mt-2">Personalize logo, cores e domínio</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
