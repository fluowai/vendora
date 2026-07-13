import { useEffect, useState } from "react";
import { Save, Building2, FileText, Shield, Users, Plus, X, Trash2 } from "lucide-react";
import { api } from "@/src/lib/api";
import { useToast } from "@/src/components/Toast";

export default function Settings() {
  const [tab, setTab] = useState<"company" | "team" | "roles" | "departments">("company");
  const [settings, setSettings] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const { toast } = useToast();

  const tabs = [
    { id: "company" as const, label: "Empresa", icon: Building2 },
    { id: "team" as const, label: "Equipe", icon: Users },
    { id: "roles" as const, label: "Papéis", icon: Shield },
    { id: "departments" as const, label: "Departamentos", icon: FileText },
  ];

  useEffect(() => {
    loadData();
  }, [tab]);

  async function loadData() {
    try {
      if (tab === "company") {
        const data = await api.getSettings();
        setSettings(data.settings);
      } else if (tab === "team") {
        const data = await api.getTeam();
        setTeam(data.team);
      } else if (tab === "roles") {
        const data = await api.getRoles();
        setRoles(data.roles);
      } else if (tab === "departments") {
        const data = await api.getDepartments();
        setDepartments(data.departments);
      }
    } catch (e: any) {
      toast(e.message, "error");
    } finally {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Configurações</h1>
        <p className="text-muted text-sm">Gerencie sua equipe, permissões e departamentos</p>
      </div>

      <div className="flex gap-2 border-b border-border pb-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === t.id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted hover:bg-bg"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "company" && <CompanySettings settings={settings} onSaved={loadData} />}
      {tab === "team" && <TeamManagement team={team} onChanged={loadData} />}
      {tab === "roles" && <RolesList roles={roles} />}
      {tab === "departments" && <DepartmentsList departments={departments} onChanged={loadData} />}
    </div>
  );
}

function CompanySettings({ settings, onSaved }: { settings: any; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", document: "" });
  const { toast } = useToast();

  useEffect(() => {
    if (settings) setForm({ name: settings.company || "", email: settings.email || "", phone: settings.phone || "", document: settings.document || "" });
  }, [settings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.updateSettings(form);
      toast("Configurações salvas!", "success");
      onSaved();
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  if (!settings) return <div className="p-8 text-muted">Carregando...</div>;

  return (
    <form onSubmit={handleSave} className="bg-surface border border-border rounded-2xl p-6 space-y-4">
      <div>
        <label className="text-xs font-bold text-muted uppercase tracking-wider">Nome da Empresa</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full bg-bg border border-border rounded-xl p-3 text-sm mt-1 outline-none focus:border-primary/50" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Email</label>
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-bg border border-border rounded-xl p-3 text-sm mt-1 outline-none focus:border-primary/50" />
        </div>
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Telefone</label>
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full bg-bg border border-border rounded-xl p-3 text-sm mt-1 outline-none focus:border-primary/50" />
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-muted uppercase tracking-wider">CNPJ/CPF</label>
        <input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })}
          className="w-full bg-bg border border-border rounded-xl p-3 text-sm mt-1 outline-none focus:border-primary/50" />
      </div>
      <div className="bg-bg rounded-xl p-4 text-sm">
        <span className="text-muted">Plano atual: </span>
        <span className="font-bold">{settings.plan?.name || "Free"}</span>
        <span className="text-muted ml-2">| {settings.plan?.maxUsers} usuários · {settings.plan?.maxAgents} agentes</span>
      </div>
      <button type="submit" className="bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:scale-[1.02] transition-all">
        <Save className="w-4 h-4" /> Salvar Alterações
      </button>
    </form>
  );
}

function TeamManagement({ team, onChanged }: { team: any[]; onChanged: () => void }) {
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleName: "agent" });
  const { toast } = useToast();

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.inviteTeamMember(form);
      toast("Usuário convidado!", "success");
      setShowInvite(false);
      setForm({ name: "", email: "", password: "", roleName: "agent" });
      onChanged();
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este usuário?")) return;
    try {
      await api.deleteTeamMember(id);
      toast("Usuário removido", "success");
      onChanged();
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowInvite(!showInvite)} className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2">
        <Plus className="w-4 h-4" /> Convidar Membro
      </button>

      {showInvite && (
        <form onSubmit={handleInvite} className="bg-surface border border-border rounded-2xl p-4 space-y-3">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" required
            className="w-full bg-bg border border-border rounded-xl p-2 text-sm outline-none" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" required
            className="w-full bg-bg border border-border rounded-xl p-2 text-sm outline-none" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Senha temporária" type="password" required
            className="w-full bg-bg border border-border rounded-xl p-2 text-sm outline-none" />
          <select value={form.roleName} onChange={(e) => setForm({ ...form, roleName: e.target.value })}
            className="w-full bg-bg border border-border rounded-xl p-2 text-sm outline-none">
            <option value="agent">Atendente</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm">Convidar</button>
        </form>
      )}

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {team.map((member) => (
          <div key={member.id} className="flex items-center justify-between p-4 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">
                {member.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-sm">{member.name}</p>
                <p className="text-xs text-muted">{member.email}</p>
                <div className="flex gap-1 mt-1">
                  {member.roles?.map((r: string) => (
                    <span key={r} className="px-1.5 py-0.5 bg-bg border border-border rounded text-[9px] font-bold uppercase">{r}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">{member.activeConversations} convs</span>
              <button onClick={() => handleDelete(member.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RolesList({ roles }: { roles: any[] }) {
  return (
    <div className="grid gap-4">
      {roles.map((role) => (
        <div key={role.id} className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg">{role.name}</h3>
            <span className="text-xs text-muted bg-bg px-2 py-1 rounded-lg">{role.userCount} usuários</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {role.permissions?.map((p: any) => (
              <span key={`${p.action}:${p.subject}`} className="px-2 py-1 bg-primary/5 text-primary text-[10px] font-bold rounded-lg border border-primary/10">
                {p.action}:{p.subject}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DepartmentsList({ departments, onChanged }: { departments: any[]; onChanged: () => void }) {
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await api.createDepartment(newName.trim());
      setNewName("");
      onChanged();
      toast("Departamento criado!", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover departamento?")) return;
    try {
      await api.deleteDepartment(id);
      onChanged();
      toast("Departamento removido", "success");
    } catch (err: any) {
      toast(err.message, "error");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do departamento"
          className="flex-1 bg-surface border border-border rounded-xl p-3 text-sm outline-none focus:border-primary/50" />
        <button onClick={handleCreate} className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm">Criar</button>
      </div>
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        {departments.map((dept) => (
          <div key={dept.id} className="flex items-center justify-between p-4 border-b border-border last:border-0">
            <div>
              <p className="font-bold">{dept.name}</p>
              <p className="text-xs text-muted">{dept.conversationCount} conversas · {dept.ticketCount} tickets</p>
            </div>
            <button onClick={() => handleDelete(dept.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
