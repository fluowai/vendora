import { useEffect, useState } from "react"
import { Save } from "lucide-react"
import { api } from "@/src/lib/api"

export default function WhiteLabelSettings() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    customDomain: "",
    companyName: "",
    logoUrl: "",
    faviconUrl: "",
    primaryColor: "#0f766e",
    secondaryColor: "#111827",
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.getWhiteLabelProfile().then((res) => {
      const b = res.whiteLabel.branding || {}
      setForm({
        name: res.whiteLabel.name || "",
        email: res.whiteLabel.email || "",
        phone: res.whiteLabel.phone || "",
        customDomain: res.whiteLabel.customDomain || "",
        companyName: b.companyName || res.whiteLabel.name || "",
        logoUrl: b.logoUrl || "",
        faviconUrl: b.faviconUrl || "",
        primaryColor: b.primaryColor || "#0f766e",
        secondaryColor: b.secondaryColor || "#111827",
      })
    })
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.updateWhiteLabelProfile({
        name: form.name,
        email: form.email,
        phone: form.phone,
        customDomain: form.customDomain,
        branding: {
          companyName: form.companyName,
          logoUrl: form.logoUrl,
          faviconUrl: form.faviconUrl,
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
        },
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">Marca</h1>
          <p className="text-sm text-muted mt-1">Identidade visual e dominio do seu white label</p>
        </div>
        <button onClick={save} disabled={saving} className="px-5 py-3 bg-teal-700 text-white rounded-lg font-bold text-sm flex items-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome juridico/comercial" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
        <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Nome exibido" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
        <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefone" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
        <input value={form.customDomain} onChange={(e) => setForm({ ...form, customDomain: e.target.value })} placeholder="app.suamarca.com" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
        <input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="URL do logo" className="bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none" />
        <div className="flex gap-3">
          <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-12 h-12 border border-border rounded-lg bg-bg" />
          <input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="min-w-0 flex-1 bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none font-mono" />
        </div>
        <div className="flex gap-3">
          <input type="color" value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="w-12 h-12 border border-border rounded-lg bg-bg" />
          <input value={form.secondaryColor} onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })} className="min-w-0 flex-1 bg-bg border border-border rounded-lg px-4 py-3 text-sm outline-none font-mono" />
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center gap-4 p-4 rounded-lg border" style={{ borderColor: form.primaryColor, backgroundColor: `${form.primaryColor}12` }}>
          <div className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: form.primaryColor }}>
            {form.companyName.charAt(0) || "W"}
          </div>
          <div>
            <p className="font-bold text-text">{form.companyName || form.name}</p>
            <p className="text-xs text-muted">{form.customDomain || "dominio nao configurado"}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
