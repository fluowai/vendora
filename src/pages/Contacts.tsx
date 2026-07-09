import {
  Search, Filter, Plus, User, Smartphone, Mail, Building,
  Tag, Activity, MessageSquare, Ticket, ShieldAlert, Download,
  Bot, ChevronRight, PhoneCall
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { CallActionButton } from "../components/calls/CallActionButton";

type ContactView = {
  id: string;
  conversationId: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  channel: string;
  status: string;
  lastMessage?: string;
  lastMessageAt?: string;
  avatar: string;
  aiEnabled: boolean;
  priority?: string;
};

export default function Contacts() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState<ContactView[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactView | null>(null);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");
  const [activeTab, setActiveTab] = useState("Visao Geral");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const query = searchParams.get("search") || "";
    setSearch(query);
    loadContacts(query);
  }, [searchParams]);

  async function loadContacts(query = search) {
    setLoading(true);
    setError("");
    try {
      const data = await api.getConversations({ search: query || undefined });
      const mapped = data.conversations.map((conversation: any) => ({
        id: conversation.contactId || conversation.id,
        conversationId: conversation.id,
        name: conversation.name || "Contato",
        phone: conversation.phone,
        email: conversation.email,
        company: conversation.instance?.name,
        channel: conversation.channel,
        status: conversation.status,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        avatar: (conversation.name || "?").charAt(0).toUpperCase(),
        aiEnabled: !!conversation.aiEnabled,
        priority: conversation.priority,
      }));
      setContacts(mapped);
      setSelectedContact((current) => mapped.find((item) => item.id === current?.id) || mapped[0] || null);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar contatos");
    } finally {
      setLoading(false);
    }
  }

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesStatus = statusFilter === "all" || contact.status === statusFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || [contact.name, contact.phone, contact.email, contact.company]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [contacts, search, statusFilter]);

  async function createContact() {
    const name = window.prompt("Nome do contato");
    if (!name?.trim()) return;
    const phone = window.prompt("Telefone ou WhatsApp");
    try {
      const { conversation } = await api.createConversation({
        name: name.trim(),
        phone: phone?.trim() || undefined,
        channel: "web",
        initialMessage: "Contato criado manualmente no Contatos 360.",
      });
      const contact = {
        id: conversation.contactId || conversation.id,
        conversationId: conversation.id,
        name: conversation.name,
        phone: conversation.phone,
        email: conversation.email,
        company: conversation.instance?.name,
        channel: conversation.channel,
        status: conversation.status,
        lastMessage: conversation.lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        avatar: (conversation.name || "?").charAt(0).toUpperCase(),
        aiEnabled: !!conversation.aiEnabled,
        priority: conversation.priority,
      };
      setContacts((items) => [contact, ...items]);
      setSelectedContact(contact);
    } catch (e: any) {
      setError(e.message || "Erro ao criar contato");
    }
  }

  function exportCsv() {
    const rows = [
      ["Nome", "Telefone", "Email", "Canal", "Status", "Ultima mensagem"],
      ...filteredContacts.map((c) => [c.name, c.phone || "", c.email || "", c.channel, c.status, c.lastMessage || ""]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "contatos-360.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const tabs = ["Visao Geral", "Conversas", "Tickets", "Ouvidoria", "Arquivos"];

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      <div className="w-full lg:w-1/3 flex flex-col space-y-4 bg-white rounded-[2rem] border border-border p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-display font-bold text-text mb-1">Contatos 360</h1>
          <p className="text-muted text-sm mb-6">Base real consolidada pelas conversas.</p>

          <form
            className="flex items-center gap-2 mb-4"
            onSubmit={(event) => {
              event.preventDefault();
              loadContacts(search);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, telefone..."
                className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <button type="button" onClick={() => setStatusFilter(statusFilter === "all" ? "active" : statusFilter === "active" ? "closed" : "all")} className="p-2.5 bg-bg border border-border rounded-xl hover:bg-surface transition-all" title={`Filtro: ${statusFilter}`}>
              <Filter className="w-5 h-5 text-muted" />
            </button>
          </form>
          <button onClick={createContact} className="w-full bg-primary text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> Novo Contato
          </button>
          {error && <p className="text-xs text-red-500 font-bold mt-3">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-6 px-6 border-t border-border pt-4">
          {loading ? (
            <div className="p-6 text-sm text-muted">Carregando contatos...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">Nenhum contato encontrado.</div>
          ) : (
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                    selectedContact?.id === contact.id ? "bg-primary/5 border-primary/20" : "bg-white border-border hover:border-primary/50"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center font-bold text-muted group-hover:text-primary transition-colors shrink-0">
                    {contact.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-text truncate group-hover:text-primary transition-colors">{contact.name}</h4>
                    <p className="text-xs text-muted flex items-center gap-1"><Building className="w-3 h-3" /> {contact.company || contact.channel}</p>
                  </div>
                  <span className={cn("w-2 h-2 rounded-full shrink-0", contact.status === "active" ? "bg-green-500" : "bg-gray-300")} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedContact ? (
        <div className="w-full lg:w-2/3 flex flex-col bg-white rounded-[2rem] border border-border overflow-hidden shadow-sm">
          <div className="relative p-8 pb-0 flex flex-col lg:flex-row items-center lg:items-start gap-6 border-b border-border bg-gradient-to-b from-bg to-white pt-12 lg:pt-8">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button onClick={exportCsv} className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold text-muted hover:text-text transition-all flex items-center gap-2">
                <Download className="w-4 h-4" /> Exportar
              </button>
            </div>

            <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-3xl bg-white border-4 border-white shadow-xl flex items-center justify-center font-display text-4xl lg:text-5xl text-primary font-bold z-10">
              {selectedContact.avatar}
            </div>

            <div className="flex-1 text-center lg:text-left z-10 mb-6">
              <h2 className="text-2xl lg:text-3xl font-bold font-display text-text mb-2">{selectedContact.name}</h2>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-muted mb-4 font-medium">
                <span className="flex items-center gap-1"><Building className="w-4 h-4" /> {selectedContact.company || selectedContact.channel}</span>
                {selectedContact.phone && <span className="flex items-center gap-1"><PhoneCall className="w-4 h-4" /> {selectedContact.phone}</span>}
              </div>

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <div className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold border border-green-100">
                  <Activity className="w-3 h-3" /> {selectedContact.status}
                </div>
                {selectedContact.aiEnabled && (
                  <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-lg text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1">
                    <Bot className="w-3 h-3" /> IA ativa
                  </span>
                )}
                <span className="px-3 py-1 bg-bg border border-border rounded-lg text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {selectedContact.priority || "normal"}
                </span>
              </div>
            </div>
          </div>

          <div className="px-8 flex items-center gap-6 border-b border-border overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={cn(
                "py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap",
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
              )}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[#F8FAFC]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2"><User className="w-4 h-4" /> Dados do contato</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center"><Smartphone className="w-5 h-5 text-muted" /></div>
                    <div><p className="text-[10px] text-muted font-bold uppercase">Telefone</p><p className="font-medium text-sm">{selectedContact.phone || "Nao informado"}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center"><Mail className="w-5 h-5 text-muted" /></div>
                    <div><p className="text-[10px] text-muted font-bold uppercase">E-mail</p><p className="font-medium text-sm">{selectedContact.email || "Nao informado"}</p></div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Acoes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={() => navigate(`/app/inbox?search=${encodeURIComponent(selectedContact.name)}`)} className="px-4 py-3 rounded-xl bg-bg border border-border text-xs font-bold flex items-center justify-center gap-2 hover:bg-surface">
                    <MessageSquare className="w-4 h-4" /> Abrir conversa
                  </button>
                  <button onClick={() => navigate("/app/tickets", { state: { contact: selectedContact } })} className="px-4 py-3 rounded-xl bg-bg border border-border text-xs font-bold flex items-center justify-center gap-2 hover:bg-surface">
                    <Ticket className="w-4 h-4" /> Criar ticket
                  </button>
                  <button onClick={() => navigate("/app/ombudsman", { state: { contact: selectedContact } })} className="px-4 py-3 rounded-xl bg-bg border border-border text-xs font-bold flex items-center justify-center gap-2 hover:bg-surface">
                    <ShieldAlert className="w-4 h-4" /> Ouvidoria
                  </button>
                  {selectedContact.phone && (
                    <CallActionButton phone={selectedContact.phone} source="contacts" label="Ligar" className="justify-center" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-2xl shadow-sm p-4">
              <div className="flex items-start gap-4 p-4 hover:bg-bg rounded-xl transition-all cursor-pointer" onClick={() => navigate(`/app/inbox?search=${encodeURIComponent(selectedContact.name)}`)}>
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shrink-0"><MessageSquare className="w-5 h-5" /></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-bold text-sm">Ultima conversa</h4>
                    <ChevronRight className="w-4 h-4 text-muted" />
                  </div>
                  <p className="text-xs text-muted">{selectedContact.lastMessage || "Sem mensagens registradas."}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full lg:w-2/3 flex items-center justify-center bg-bg/50 rounded-[2rem] border border-border border-dashed">
          <div className="text-center text-muted">
            <User className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-bold">Selecione um contato</h2>
            <p className="text-sm">A base sera preenchida pelas conversas reais.</p>
          </div>
        </div>
      )}
    </div>
  );
}
