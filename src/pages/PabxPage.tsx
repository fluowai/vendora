import { useState } from "react";
import {
  Phone, Plus, Trash2, Edit3, Users, GitBranch, Voicemail,
  ArrowRight, BarChart3, Loader2, PhoneIncoming,
  PhoneOutgoing, XCircle,
} from "lucide-react";
import { usePabxExtensions, usePabxQueues, usePabxIvr, usePabxRoutes, usePabxStats } from "../hooks/usePabx";
import type { PabxExtension, PabxQueue, PabxIvrMenu, PabxCallRoute } from "../types/pabx";

type Tab = "dashboard" | "extensions" | "queues" | "ivr" | "routes";

const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "extensions", label: "Ramais", icon: Phone },
  { id: "queues", label: "Filas", icon: Users },
  { id: "ivr", label: "URA", icon: Voicemail },
  { id: "routes", label: "Rotas", icon: GitBranch },
];

export default function PabxPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-text">PABX em Nuvem</h1>
          <p className="text-muted text-sm mt-1">Central de telefonia virtual com ramais, filas e URA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-2xl p-1.5 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-muted hover:text-text hover:bg-bg"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && <DashboardTab />}
      {activeTab === "extensions" && <ExtensionsTab />}
      {activeTab === "queues" && <QueuesTab />}
      {activeTab === "ivr" && <IvrTab />}
      {activeTab === "routes" && <RoutesTab />}
    </div>
  );
}

// ===== DASHBOARD =====

function DashboardTab() {
  const { stats, recentCalls, loading } = usePabxStats();

  if (loading && !stats) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const cards = [
    { label: "Ramais Totais", value: stats?.totalExtensions ?? 0, icon: Phone, color: "text-blue-600 bg-blue-50" },
    { label: "Ramais Ativos", value: stats?.activeExtensions ?? 0, icon: Phone, color: "text-green-600 bg-green-50" },
    { label: "Filas", value: stats?.totalQueues ?? 0, icon: Users, color: "text-purple-600 bg-purple-50" },
    { label: "URAs Ativas", value: stats?.activeIvrMenus ?? 0, icon: Voicemail, color: "text-orange-600 bg-orange-50" },
    { label: "Rotas Ativas", value: stats?.activeRoutes ?? 0, icon: GitBranch, color: "text-cyan-600 bg-cyan-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-surface border border-border rounded-2xl p-5 card-shadow">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-display font-bold text-text">{card.value}</p>
            <p className="text-xs text-muted font-medium mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 card-shadow">
        <h3 className="font-display font-bold text-text mb-4">Últimas Chamadas</h3>
        {recentCalls.length === 0 ? (
          <p className="text-muted text-sm">Nenhuma chamada registrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {recentCalls.slice(0, 10).map(call => (
              <div key={call.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    call.direction === "inbound" ? "bg-green-50 text-green-600" : "bg-blue-50 text-blue-600"
                  }`}>
                    {call.direction === "inbound" ? <PhoneIncoming className="w-4 h-4" /> : <PhoneOutgoing className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text">{call.callerId}</p>
                    <p className="text-xs text-muted">{call.callerName || call.direction === "inbound" ? "Entrada" : "Saída"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-medium ${
                    call.status === "connected" ? "text-green-600" :
                    call.status === "missed" ? "text-red-600" : "text-muted"
                  }`}>{call.status}</p>
                  {call.duration && <p className="text-xs text-muted">{call.duration}s</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display font-bold text-text text-lg">Pronto para usar?</h3>
            <p className="text-muted text-sm mt-1 max-w-md">
              Configure seus ramais, crie filas de atendimento e defina rotas de chamada para começar a usar seu PABX em nuvem.
            </p>
          </div>
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Phone className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== EXTENSIONS =====

function ExtensionsTab() {
  const { extensions, loading, create, update, remove } = usePabxExtensions();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PabxExtension | null>(null);
  const [form, setForm] = useState<{ extension: string; name: string; mobile: string; status: string }>({ extension: "", name: "", mobile: "", status: "active" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.extension || !form.name) return;
    setSaving(true);
    try {
      if (editing) {
        await update(editing.id, form as any);
      } else {
        await create(form as any);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ extension: "", name: "", mobile: "", status: "active" });
    } finally { setSaving(false); }
  }

  function handleEdit(ext: PabxExtension) {
    setEditing(ext);
    setForm({ extension: ext.extension, name: ext.name, mobile: ext.mobile || "", status: ext.status });
    setShowForm(true);
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{extensions.length} ramais configurados</p>
        <button onClick={() => { setEditing(null); setForm({ extension: "", name: "", mobile: "", status: "active" }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Novo Ramal
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-2xl p-6 card-shadow">
          <h3 className="font-display font-bold text-text mb-4">{editing ? "Editar Ramal" : "Novo Ramal"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Número do Ramal</label>
              <input value={form.extension} onChange={e => setForm(p => ({ ...p, extension: e.target.value }))} placeholder="Ex: 101" className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Nome</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Vendas" className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">WhatsApp/Telefone</label>
              <input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} placeholder="Número do ramal" className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="active">Ativo</option>
                <option value="paused">Pausado</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-6 py-2.5 bg-bg border border-border text-text font-bold rounded-xl text-sm hover:bg-border transition-all">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl card-shadow overflow-hidden">
        {extensions.length === 0 ? (
          <div className="p-12 text-center">
            <Phone className="w-12 h-12 text-muted/30 mx-auto mb-4" />
            <p className="text-muted font-medium">Nenhum ramal cadastrado</p>
            <p className="text-muted text-sm mt-1">Crie seu primeiro ramal para começar</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {extensions.map(ext => (
              <div key={ext.id} className="flex items-center justify-between p-4 hover:bg-bg/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                    ext.status === "active" ? "bg-green-50 text-green-600" :
                    ext.status === "paused" ? "bg-yellow-50 text-yellow-600" : "bg-gray-50 text-gray-400"
                  }`}>{ext.extension}</div>
                  <div>
                    <p className="font-medium text-text">{ext.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs font-medium ${
                        ext.status === "active" ? "text-green-600" :
                        ext.status === "paused" ? "text-yellow-600" : "text-gray-400"
                      }`}>{ext.status === "active" ? "Ativo" : ext.status === "paused" ? "Pausado" : "Offline"}</span>
                      {ext.mobile && <><span className="text-muted/30">|</span><span className="text-xs text-muted">{ext.mobile}</span></>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(ext)} className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => remove(ext.id)} className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== QUEUES =====

function QueuesTab() {
  const { queues, loading, create, update, remove } = usePabxQueues();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PabxQueue | null>(null);
  const [form, setForm] = useState<{ name: string; strategy: string; ringTimeout: number; maxWaitTime: number; maxCallers: number }>({ name: "", strategy: "ringall", ringTimeout: 30, maxWaitTime: 300, maxCallers: 10 });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) { await update(editing.id, form as any); }
      else { await create(form as any); }
      setShowForm(false); setEditing(null);
      setForm({ name: "", strategy: "ringall", ringTimeout: 30, maxWaitTime: 300, maxCallers: 10 });
    } finally { setSaving(false); }
  }

  const strategyLabels: Record<string, string> = {
    ringall: "Todos ao mesmo tempo",
    leastrecent: "Menos recente",
    fewestcalls: "Menos chamadas",
    random: "Aleatório",
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{queues.length} filas configuradas</p>
        <button onClick={() => { setEditing(null); setForm({ name: "", strategy: "ringall", ringTimeout: 30, maxWaitTime: 300, maxCallers: 10 }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Nova Fila
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-2xl p-6 card-shadow">
          <h3 className="font-display font-bold text-text mb-4">{editing ? "Editar Fila" : "Nova Fila"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Nome da Fila</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Suporte" className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Estratégia</label>
              <select value={form.strategy} onChange={e => setForm(p => ({ ...p, strategy: e.target.value as any }))} className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                {Object.entries(strategyLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Tempo de Toque (s)</label>
              <input type="number" value={form.ringTimeout} onChange={e => setForm(p => ({ ...p, ringTimeout: +e.target.value }))} className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Espera Máxima (s)</label>
              <input type="number" value={form.maxWaitTime} onChange={e => setForm(p => ({ ...p, maxWaitTime: +e.target.value }))} className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-6 py-2.5 bg-bg border border-border text-text font-bold rounded-xl text-sm hover:bg-border transition-all">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {queues.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center card-shadow">
            <Users className="w-12 h-12 text-muted/30 mx-auto mb-4" />
            <p className="text-muted font-medium">Nenhuma fila cadastrada</p>
            <p className="text-muted text-sm mt-1">Crie filas para distribuir chamadas entre os ramais</p>
          </div>
        ) : queues.map(queue => (
          <div key={queue.id} className="bg-surface border border-border rounded-2xl p-5 card-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-bold text-text">{queue.name}</p>
                  <span className="text-xs text-muted">{strategyLabels[queue.strategy]} · {queue.members.length} membros</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  queue.status === "active" ? "bg-green-50 text-green-600" : "bg-yellow-50 text-yellow-600"
                }`}>{queue.status === "active" ? "Ativo" : "Pausado"}</span>
                <button onClick={() => handleEdit(queue)} className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => remove(queue.id)} className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {queue.members.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {queue.members.map(m => (
                  <div key={m.id} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-bg border border-border rounded-lg text-xs font-medium text-text">
                    <Phone className="w-3 h-3" />
                    {m.extension?.extension} - {m.extension?.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  function handleEdit(queue: PabxQueue) {
    setEditing(queue);
    setForm({ name: queue.name, strategy: queue.strategy, ringTimeout: queue.ringTimeout, maxWaitTime: queue.maxWaitTime, maxCallers: queue.maxCallers });
    setShowForm(true);
  }
}

// ===== IVR =====

function IvrTab() {
  const { menus, loading, create, update, remove, addOption, removeOption } = usePabxIvr();
  const { extensions } = usePabxExtensions();
  const { queues } = usePabxQueues();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PabxIvrMenu | null>(null);
  const [form, setForm] = useState({ name: "", greeting: "Bem-vindo! Para falar com Vendas, digite 1. Para Suporte, digite 2." });
  const [saving, setSaving] = useState(false);

  const [optionForm, setOptionForm] = useState<{ menuId: string; digit: string; description: string; destinationType: string; destinationId: string }>({ menuId: "", digit: "1", description: "", destinationType: "extension", destinationId: "" });

  async function handleSave() {
    if (!form.name) return;
    setSaving(true);
    try {
      if (editing) { await update(editing.id, form); }
      else { await create(form); }
      setShowForm(false); setEditing(null);
      setForm({ name: "", greeting: "Bem-vindo! Para falar com Vendas, digite 1. Para Suporte, digite 2." });
    } finally { setSaving(false); }
  }

  async function handleAddOption(menuId: string) {
    if (!optionForm.digit || !optionForm.destinationId) return;
    await addOption(menuId, optionForm as any);
    setOptionForm({ menuId: "", digit: "1", description: "", destinationType: "extension", destinationId: "" });
  }

  function getDestLabel(type: string, id: string): string {
    if (type === "extension") return extensions.find(e => e.id === id)?.extension || id;
    if (type === "queue") return queues.find(q => q.id === id)?.name || id;
    if (type === "ivr") return menus.find(m => m.id === id)?.name || id;
    return id;
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{menus.length} menus URA configurados</p>
        <button onClick={() => { setEditing(null); setForm({ name: "", greeting: "Bem-vindo! Para falar com Vendas, digite 1. Para Suporte, digite 2." }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Novo Menu URA
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-2xl p-6 card-shadow">
          <h3 className="font-display font-bold text-text mb-4">{editing ? "Editar URA" : "Nova URA"}</h3>
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Nome do Menu</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Menu Principal" className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Saudação (Texto para TTS)</label>
              <textarea value={form.greeting} onChange={e => setForm(p => ({ ...p, greeting: e.target.value }))} rows={3} placeholder="Mensagem de boas-vindas..." className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-6 py-2.5 bg-bg border border-border text-text font-bold rounded-xl text-sm hover:bg-border transition-all">Cancelar</button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {menus.length === 0 ? (
          <div className="bg-surface border border-border rounded-2xl p-12 text-center card-shadow">
            <Voicemail className="w-12 h-12 text-muted/30 mx-auto mb-4" />
            <p className="text-muted font-medium">Nenhum menu URA cadastrado</p>
            <p className="text-muted text-sm mt-1">Crie menus interativos para direcionar chamadas</p>
          </div>
        ) : menus.map(menu => (
          <div key={menu.id} className="bg-surface border border-border rounded-2xl p-5 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Voicemail className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-bold text-text">{menu.name}</p>
                  <p className="text-xs text-muted">{menu.options.length} opções · {menu.status === "active" ? "Ativo" : "Inativo"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditing(menu); setForm({ name: menu.name, greeting: menu.greeting || "" }); setShowForm(true); }} className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => remove(menu.id)} className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            {menu.greeting && (
              <div className="mb-3 p-3 bg-bg border border-border rounded-xl text-sm text-muted italic">
                "{menu.greeting}"
              </div>
            )}

            {menu.options.length > 0 && (
              <div className="space-y-2 mb-4">
                {menu.options.map(opt => (
                  <div key={opt.id} className="flex items-center justify-between p-2 bg-bg rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center text-xs font-bold">{opt.digit}</span>
                      <span className="text-sm text-text">{opt.description || getDestLabel(opt.destinationType, opt.destinationId)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted bg-surface px-2 py-0.5 rounded-md border border-border">{opt.destinationType}</span>
                      <button onClick={() => removeOption(menu.id, opt.id)} className="text-muted hover:text-red-500"><XCircle className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t border-border pt-4">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Adicionar Opção</p>
              <div className="flex items-center gap-2 flex-wrap">
                <select value={optionForm.digit} onChange={e => setOptionForm(p => ({ ...p, menuId: menu.id, digit: e.target.value }))} className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs">
                  {["1","2","3","4","5","6","7","8","9","0","*","#"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input value={optionForm.description} onChange={e => setOptionForm(p => ({ ...p, menuId: menu.id, description: e.target.value }))} placeholder="Descrição" className="flex-1 min-w-[120px] px-3 py-1.5 bg-bg border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <select value={optionForm.destinationType} onChange={e => setOptionForm(p => ({ ...p, menuId: menu.id, destinationType: e.target.value as any }))} className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs">
                  <option value="extension">Ramal</option>
                  <option value="queue">Fila</option>
                  <option value="ivr">Outro Menu</option>
                </select>
                <select value={optionForm.destinationId} onChange={e => setOptionForm(p => ({ ...p, menuId: menu.id, destinationId: e.target.value }))} className="px-2 py-1.5 bg-bg border border-border rounded-lg text-xs">
                  <option value="">Selecionar...</option>
                  {optionForm.destinationType === "extension" && extensions.map(e => <option key={e.id} value={e.id}>Ramal {e.extension} - {e.name}</option>)}
                  {optionForm.destinationType === "queue" && queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                  {optionForm.destinationType === "ivr" && menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <button onClick={() => handleAddOption(menu.id)} className="px-3 py-1.5 bg-primary text-white font-bold rounded-lg text-xs hover:scale-105 transition-all">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== ROUTES =====

function RoutesTab() {
  const { routes, loading, create, update, remove } = usePabxRoutes();
  const { extensions } = usePabxExtensions();
  const { queues } = usePabxQueues();
  const { menus } = usePabxIvr();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PabxCallRoute | null>(null);
  const [form, setForm] = useState<{ name: string; source: string; destinationType: string; destinationId: string }>({ name: "", source: "*", destinationType: "extension", destinationId: "" });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name || !form.source) return;
    setSaving(true);
    try {
      const payload = { ...form, destinationId: form.destinationId || undefined } as any;
      if (editing) { await update(editing.id, payload); }
      else { await create(payload); }
      setShowForm(false); setEditing(null);
      setForm({ name: "", source: "*", destinationType: "extension", destinationId: "" });
    } finally { setSaving(false); }
  }

  const destTypeLabels: Record<string, string> = {
    extension: "Ramal",
    queue: "Fila",
    ivr: "URA",
    voicemail: "Caixa Postal",
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{routes.length} rotas configuradas</p>
        <button onClick={() => { setEditing(null); setForm({ name: "", source: "*", destinationType: "extension", destinationId: "" }); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20">
          <Plus className="w-4 h-4" /> Nova Rota
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-2xl p-6 card-shadow">
          <h3 className="font-display font-bold text-text mb-4">{editing ? "Editar Rota" : "Nova Rota"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Nome da Rota</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Todas chamadas" className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Origem (número ou *)</label>
              <input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="* = todas" className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Tipo de Destino</label>
              <select value={form.destinationType} onChange={e => setForm(p => ({ ...p, destinationType: e.target.value as any }))} className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                {Object.entries(destTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1.5 block">Destino</label>
              <select value={form.destinationId} onChange={e => setForm(p => ({ ...p, destinationId: e.target.value }))} className="w-full px-4 py-2.5 bg-bg border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="">Selecionar...</option>
                {form.destinationType === "extension" && extensions.map(e => <option key={e.id} value={e.id}>Ramal {e.extension} - {e.name}</option>)}
                {form.destinationType === "queue" && queues.map(q => <option key={q.id} value={q.id}>{q.name}</option>)}
                {form.destinationType === "ivr" && menus.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-primary text-white font-bold rounded-xl text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
              {saving ? "Salvando..." : "Salvar"}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-6 py-2.5 bg-bg border border-border text-text font-bold rounded-xl text-sm hover:bg-border transition-all">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-surface border border-border rounded-2xl card-shadow overflow-hidden">
        {routes.length === 0 ? (
          <div className="p-12 text-center">
            <GitBranch className="w-12 h-12 text-muted/30 mx-auto mb-4" />
            <p className="text-muted font-medium">Nenhuma rota cadastrada</p>
            <p className="text-muted text-sm mt-1">Defina rotas para direcionar chamadas para ramais, filas ou URA</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {routes.map(route => (
              <div key={route.id} className="flex items-center justify-between p-4 hover:bg-bg/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                    <GitBranch className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-text">{route.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono bg-bg px-1.5 py-0.5 rounded text-muted">{route.source}</span>
                      <ArrowRight className="w-3 h-3 text-muted" />
                      <span className="text-xs font-medium text-primary">{destTypeLabels[route.destinationType]}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    route.status === "active" ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"
                  }`}>{route.status === "active" ? "Ativa" : "Inativa"}</span>
                  <button onClick={() => { setEditing(route); setForm({ name: route.name, source: route.source, destinationType: route.destinationType as any, destinationId: route.destinationId || "" }); setShowForm(true); }} className="p-2 text-muted hover:text-text hover:bg-bg rounded-lg transition-all"><Edit3 className="w-4 h-4" /></button>
                  <button onClick={() => remove(route.id)} className="p-2 text-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
