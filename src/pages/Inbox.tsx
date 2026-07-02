import {
  Bot,
  CheckCheck,
  ChevronRight,
  Clock,
  Filter,
  Globe,
  Info,
  Instagram,
  Mail,
  MessageSquare,
  MoreVertical,
  Plus,
  Search,
  Send,
  Smartphone,
  Ticket,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";

export default function Inbox() {
  const [activeChat, setActiveChat] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "chat" | "info">("list");
  const [search, setSearch] = useState("");
  const [chatType, setChatType] = useState<"all" | "private" | "group">("all");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeChat && window.innerWidth < 1024) setView("chat");
  }, [activeChat]);

  const loadConversations = async (query = search, type = chatType) => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getConversations({ search: query, chatType: type === "all" ? undefined : type });
      setConversations(data.conversations);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (chat: any) => {
    setActiveChat(chat);
    try {
      const data = await api.getConversation(chat.id);
      setActiveChat(data.conversation);
    } catch (e: any) {
      setError(e.message || "Erro ao abrir conversa");
    }
  };

  const sendMessage = async () => {
    if (!activeChat || !draft.trim() || sending) return;

    const content = draft.trim();
    setDraft("");
    setSending(true);
    setError("");

    try {
      const { message } = await api.sendConversationMessage(activeChat.id, content);
      setActiveChat((chat: any) => ({
        ...chat,
        lastMessage: content,
        messages: [...(chat.messages || []), message],
      }));
      setConversations((items) => items.map((item) => (
        item.id === activeChat.id
          ? { ...item, lastMessage: content, lastMessageAt: message.sentAt, time: message.sentAt }
          : item
      )));
    } catch (e: any) {
      setDraft(content);
      setError(e.message || "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (value?: string) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsmeow":
      case "whatsapp": return <Smartphone className="w-3 h-3 text-white" />;
      case "instagram": return <Instagram className="w-3 h-3 text-white" />;
      case "web":
      case "webchat": return <Globe className="w-3 h-3 text-white" />;
      case "email": return <Mail className="w-3 h-3 text-white" />;
      default: return <MessageSquare className="w-3 h-3 text-white" />;
    }
  };

  const changeChatType = (type: "all" | "private" | "group") => {
    setChatType(type);
    loadConversations(search, type);
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case "whatsmeow":
      case "whatsapp": return "bg-[#25D366]";
      case "instagram": return "bg-pink-500";
      case "web":
      case "webchat": return "bg-blue-500";
      case "email": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] lg:h-[calc(100vh-160px)] flex bg-surface lg:rounded-[2.5rem] border border-border overflow-hidden card-shadow">
      <div className={cn(
        "w-full lg:w-[350px] border-r border-border flex flex-col bg-surface transition-all duration-300",
        view !== "list" && "hidden lg:flex",
      )}>
        <div className="p-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg">Mensagens</h2>
            <button onClick={() => loadConversations()} className="p-2 hover:bg-bg rounded-xl transition-colors">
              <Filter className="w-4 h-4 text-muted" />
            </button>
          </div>
          <form
            className="relative"
            onSubmit={(e) => {
              e.preventDefault();
              loadConversations(search);
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar contatos, tags ou msgs..."
              className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-all text-text"
            />
          </form>
          {error && <p className="text-xs text-red-500 font-bold">{error}</p>}
          <div className="grid grid-cols-3 gap-1 bg-bg border border-border rounded-xl p-1">
            {[
              { id: "all", label: "Todas" },
              { id: "private", label: "Privadas" },
              { id: "group", label: "Grupos" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => changeChatType(item.id as "all" | "private" | "group")}
                className={cn(
                  "h-8 rounded-lg text-[11px] font-bold transition-all",
                  chatType === item.id ? "bg-white text-primary shadow-sm" : "text-muted hover:text-text",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="p-6 text-sm text-muted">Carregando conversas...</div>
          ) : conversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
              <MessageSquare className="w-12 h-12 text-muted mb-4" />
              <h3 className="font-display font-bold text-muted">Nenhuma conversa encontrada</h3>
              <p className="text-xs text-muted mt-2">Quando um canal real enviar mensagens, elas aparecem aqui.</p>
            </div>
          ) : conversations.map((chat) => (
            <button
              key={chat.id}
              onClick={() => openConversation(chat)}
              className={cn(
                "w-full p-4 flex items-start gap-3 border-b border-border hover:bg-bg transition-all text-left group",
                activeChat?.id === chat.id && "bg-primary/5 border-l-4 border-l-primary",
              )}
            >
              <div className="relative shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-bg border border-border flex items-center justify-center font-bold text-muted text-lg shadow-sm">
                  {(chat.name || "?").charAt(0)}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-surface flex items-center justify-center shadow-sm",
                  getChannelColor(chat.channel),
                )}>
                  {getChannelIcon(chat.channel)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-sm truncate text-text">{chat.name}</h4>
                  <span className="text-[10px] text-muted whitespace-nowrap">{formatTime(chat.time)}</span>
                </div>
                <p className="text-xs text-muted truncate mb-2">{chat.lastMessage || "Sem mensagens ainda"}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {chat.instance?.name && (
                    <span className="px-1.5 py-0.5 bg-[#25D366]/10 text-[#128C7E] text-[8px] font-bold uppercase rounded">
                      {chat.instance.name}
                    </span>
                  )}
                  {chat.isGroup && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[8px] font-bold uppercase rounded">
                      grupo
                    </span>
                  )}
                  {chat.aiEnabled && (
                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-[8px] font-bold uppercase rounded flex items-center gap-1">
                      <Bot className="w-2 h-2" /> IA ativa
                    </span>
                  )}
                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[8px] font-bold uppercase rounded">
                    {chat.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {chat.unread > 0 ? (
                  <div className="bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-lg flex items-center justify-center">
                    {chat.unread}
                  </div>
                ) : <div className="w-5 h-5" />}
                <span className="text-[10px] text-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {chat.priority || "normal"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        "flex-1 flex-col bg-[#F8FAFC] transition-all duration-300 relative",
        view === "chat" ? "flex" : view === "list" ? "hidden lg:flex" : "hidden lg:flex",
      )}>
        <div className="h-16 lg:h-20 border-b border-border px-4 lg:px-6 flex items-center justify-between bg-white/80 backdrop-blur-md z-10 absolute top-0 left-0 right-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="lg:hidden p-2 -ml-2 text-muted hover:text-text">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center font-bold text-muted">
              {activeChat ? activeChat.name.charAt(0) : "?"}
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                {activeChat?.name || "Selecione uma conversa"}
                {activeChat?.status === "active" && <div className="w-2 h-2 rounded-full bg-green-500" title="Ativa" />}
              </h3>
              <p className="text-[11px] text-muted">
                {activeChat ? `${activeChat.isGroup ? "Grupo" : "Privada"} · ${activeChat.instance?.name || activeChat.channel}` : "Aguardando selecao"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-bold text-muted hover:text-primary transition-all shadow-sm">
              <Bot className="w-4 h-4" /> Sugerir Resposta
            </button>
            <button className="p-2 rounded-xl hover:bg-bg text-muted transition-all lg:hidden" onClick={() => setView("info")}>
              <Info className="w-5 h-5" />
            </button>
            <button className="hidden lg:flex p-2 rounded-xl hover:bg-bg text-muted transition-all">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-24 pb-6 px-4 lg:px-8 space-y-6 custom-scrollbar">
          {activeChat ? (
            (activeChat.messages || []).length > 0 ? (
              activeChat.messages.map((message: any) => {
                const outbound = message.senderType !== "contact" && message.role !== "user";
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col max-w-[80%] lg:max-w-[70%]",
                      outbound ? "items-end ml-auto" : "items-start",
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-2xl shadow-sm text-sm",
                      outbound
                        ? "bg-primary text-white rounded-tr-sm"
                        : "bg-white border border-border text-text rounded-tl-sm",
                    )}>
                      {!outbound && activeChat?.isGroup && (
                        <div className="text-[10px] font-bold text-[#128C7E] uppercase tracking-wide mb-1">
                          {message.metadata?.senderName || message.metadata?.participantJid || "Participante"}
                        </div>
                      )}
                      {outbound && message.senderType === "ai" && (
                        <div className="flex items-center gap-1.5 mb-1.5 opacity-80 border-b border-white/20 pb-1.5">
                          <Bot className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Agente IA</span>
                        </div>
                      )}
                      {message.content}
                    </div>
                    <div className="flex items-center gap-1 mt-1 mx-1">
                      <span className="text-[10px] text-muted">{formatTime(message.sentAt)}</span>
                      {outbound && <CheckCheck className="w-3 h-3 text-primary" />}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                <MessageSquare className="w-16 h-16 text-muted mb-4" />
                <h3 className="text-xl font-display font-bold text-muted">Conversa sem mensagens</h3>
              </div>
            )
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
              <MessageSquare className="w-16 h-16 text-muted mb-4" />
              <h3 className="text-xl font-display font-bold text-muted">Selecione uma conversa</h3>
            </div>
          )}
        </div>

        {activeChat && (
          <div className="px-4 py-2 bg-white border-t border-border flex items-center gap-2 overflow-x-auto no-scrollbar">
            <button className="shrink-0 px-3 py-1.5 bg-bg hover:bg-surface border border-border rounded-lg text-xs font-bold text-muted flex items-center gap-1 transition-all">
              <Ticket className="w-3 h-3" /> Criar Ticket
            </button>
            <button className="shrink-0 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-xs font-bold text-primary flex items-center gap-1 transition-all">
              <Bot className="w-3 h-3" /> Resumo IA
            </button>
          </div>
        )}

        <div className="p-4 bg-white">
          <div className="flex items-end gap-2 bg-bg border border-border rounded-2xl p-2 focus-within:border-primary/50 focus-within:ring-2 ring-primary/10 transition-all shadow-sm">
            <button className="p-2 rounded-xl hover:bg-surface text-muted shrink-0">
              <Plus className="w-5 h-5" />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-2 max-h-32 min-h-[40px] resize-none custom-scrollbar"
              disabled={!activeChat || sending}
              rows={1}
            />
            <button
              onClick={sendMessage}
              className="bg-primary text-white p-2.5 rounded-xl hover:scale-105 transition-all shadow-md disabled:opacity-50"
              disabled={!activeChat || !draft.trim() || sending}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className={cn(
        "w-full lg:w-[320px] border-l border-border bg-white absolute inset-0 lg:static z-20 transition-all duration-300 overflow-y-auto custom-scrollbar shadow-xl lg:shadow-none",
        view === "info" ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        !activeChat && "hidden lg:block opacity-50 pointer-events-none",
      )}>
        <div className="flex items-center justify-between lg:hidden p-4 border-b border-border bg-white sticky top-0 z-10">
          <button onClick={() => setView("chat")} className="p-2 -ml-2 text-muted">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <h3 className="font-bold text-sm">Contato 360</h3>
          <div className="w-10" />
        </div>

        {activeChat ? (
          <div className="p-6 space-y-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 border-4 border-white shadow-lg flex items-center justify-center text-3xl font-display font-bold text-primary mb-4">
                {activeChat.name.charAt(0)}
              </div>
              <h4 className="font-bold text-xl text-text">{activeChat.name}</h4>
              <p className="text-sm text-muted mb-3">Instância: {activeChat.instance?.name || activeChat.channel}</p>
              <div className="flex gap-2 w-full">
                <button className="flex-1 py-2 bg-bg border border-border rounded-xl text-xs font-bold hover:bg-surface transition-all flex items-center justify-center gap-2">
                  <User className="w-4 h-4" /> Perfil
                </button>
                <button className="flex-1 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                  <Bot className="w-4 h-4" /> Resumo IA
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-[10px] font-bold text-muted uppercase tracking-widest">Detalhes do Contato</h5>
              <div className="flex items-center gap-3 p-3 bg-bg rounded-xl border border-border/50">
                <Smartphone className="w-4 h-4 text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted font-medium">Telefone</p>
                  <p className="text-sm font-bold truncate">{activeChat.phone || "Nao informado"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-bg rounded-xl border border-border/50">
                <Mail className="w-4 h-4 text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-muted font-medium">E-mail</p>
                  <p className="text-sm font-bold truncate">{activeChat.email || "Nao informado"}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center p-6 text-center text-muted">
            <p className="text-sm">Selecione uma conversa para ver os detalhes 360.</p>
          </div>
        )}
      </div>
    </div>
  );
}
