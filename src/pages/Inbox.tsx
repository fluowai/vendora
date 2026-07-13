import {
  Bot,
  CheckCheck,
  ChevronRight,
  Clock,
  Cpu,
  Download,
  Edit2,
  FileText,
  Filter,
  Globe,
  Image as ImageIcon,
  Info,
  Instagram,
  Mail,
  MessageSquare,
  Mic,
  MoreVertical,
  Paperclip,
  Search,
  Send,
  Smartphone,
  Square,
  Ticket,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import { CallActionButton } from "../components/calls/CallActionButton";
import { useSocket } from "../hooks/useSocket";
import { formatPhoneForDisplay } from "../lib/phone";

export default function Inbox() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") || "";
  const [activeChat, setActiveChat] = useState<any>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [view, setView] = useState<"list" | "chat" | "info">("list");
  const [search, setSearch] = useState(initialSearch);
  const [chatType, setChatType] = useState<"all" | "private" | "group">("all");
  const [draft, setDraft] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const { lastMessage, joinConversation, leaveConversation } = useSocket();

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

  useEffect(() => {
    const query = searchParams.get("search") || "";
    setSearch(query);
    loadConversations(query);
  }, [searchParams]);

  useEffect(() => {
    if (activeChat && window.innerWidth < 1024) setView("chat");
  }, [activeChat]);

  useEffect(() => {
    if (!activeChat?.id) return;
    joinConversation(activeChat.id);
    return () => leaveConversation(activeChat.id);
  }, [activeChat?.id, joinConversation, leaveConversation]);

  const sortConversations = (items: any[]) =>
    [...items].sort((a, b) =>
      new Date(b.lastMessageAt || b.time || b.createdAt || 0).getTime()
      - new Date(a.lastMessageAt || a.time || a.createdAt || 0).getTime()
    );

  const conversationMatchesFilters = (conversation: any) => {
    const type = conversation.chatType || (conversation.isGroup ? "group" : "private");
    if (chatType !== "all" && type !== chatType) return false;

    const query = search.trim().toLowerCase();
    if (!query) return true;

    return [conversation.name, conversation.phone, conversation.email, conversation.lastMessage]
      .some((value) => String(value || "").toLowerCase().includes(query));
  };

  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "conversation:new" && lastMessage.data) {
      const incoming = lastMessage.data;
      if (!conversationMatchesFilters(incoming)) return;
      setConversations((items) =>
        sortConversations([
          incoming,
          ...items.filter((item) => item.id !== incoming.id),
        ])
      );
      return;
    }

    if (lastMessage.type === "conversation:updated" && lastMessage.data) {
      const update = lastMessage.data.conversation || lastMessage.data;
      const id = update.id || lastMessage.data.conversationId;
      setConversations((items) => {
        const exists = items.some((item) => item.id === id);
        const updated = items.map((item) =>
          item.id === id
            ? {
                ...item,
                ...update,
                lastMessage: update.lastMessage ?? lastMessage.data.lastMessage ?? item.lastMessage,
                lastMessageAt: update.lastMessageAt ?? lastMessage.data.lastMessageAt ?? item.lastMessageAt,
                time: update.time ?? lastMessage.data.time ?? lastMessage.data.lastMessageAt ?? item.time,
              }
            : item
        );
        if (!exists && update.id && conversationMatchesFilters(update)) {
          updated.unshift(update);
        }
        return sortConversations(updated);
      });
      return;
    }

    if (lastMessage.type === "message:new" && lastMessage.message) {
      const { conversationId, message } = lastMessage;
      setActiveChat((chat: any) => {
        if (!chat || chat.id !== conversationId) return chat;
        const messages = chat.messages || [];
        if (messages.some((item: any) => item.id === message.id)) return chat;
        return {
          ...chat,
          lastMessage: message.content,
          lastMessageAt: message.sentAt,
          messages: [...messages, message],
        };
      });
      setConversations((items) =>
        sortConversations(items.map((item) =>
          item.id === conversationId
            ? { ...item, lastMessage: message.content, lastMessageAt: message.sentAt, time: message.sentAt }
            : item
        ))
      );
    }
  }, [lastMessage, chatType, search]);

  const openConversation = async (chat: any) => {
    setActiveChat(chat);
    setLeadName(chat.name || "");
    setEditingName(false);
    setView("chat");
    try {
      const data = await api.getConversation(chat.id);
      setActiveChat(data.conversation);
      setLeadName(data.conversation.name || "");
    } catch (e: any) {
      setError(e.message || "Erro ao abrir conversa");
    }
  };

  const openInfoPanel = () => {
    if (!activeChat) return;
    setView("info");
  };

  const closeInfoPanel = () => {
    setView(activeChat ? "chat" : "list");
  };

  const startEditingName = () => {
    if (!activeChat) return;
    setLeadName(activeChat.name || "");
    setEditingName(true);
    setView("info");
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

  const saveLeadName = async () => {
    if (!activeChat || !leadName.trim()) return;
    try {
      const { conversation } = await api.updateConversation(activeChat.id, { contactName: leadName.trim() });
      setActiveChat((chat: any) => ({ ...chat, ...conversation, messages: chat.messages || conversation.messages || [] }));
      setConversations((items) => items.map((item) => item.id === activeChat.id ? { ...item, name: conversation.name } : item));
      setEditingName(false);
    } catch (e: any) {
      setError(e.message || "Erro ao atualizar nome");
    }
  };

  const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const mediaTypeFromMime = (mimeType: string) => {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType === "application/pdf") return "document";
    return "file";
  };

  const sendMedia = async (file: File | Blob, fileName: string, fallbackText?: string) => {
    if (!activeChat || uploading || sending) return;
    setUploading(true);
    setError("");
    try {
      const mimeType = file.type || "application/octet-stream";
      const base64 = await blobToBase64(file);
      const uploaded = await api.uploadMedia(base64, mimeType, fileName);
      const messageType = mediaTypeFromMime(mimeType);
      const content = draft.trim() || fallbackText || fileName;
      setDraft("");
      const { message } = await api.sendConversationMessage(activeChat.id, content, {}, {
        messageType,
        mediaUrl: uploaded.url,
        mediaMimeType: uploaded.mimeType,
        mediaName: uploaded.fileName,
        mediaSize: uploaded.size,
      });
      setActiveChat((chat: any) => ({
        ...chat,
        lastMessage: content,
        messages: [...(chat.messages || []), message],
      }));
      setConversations((items) => items.map((item) => item.id === activeChat.id ? { ...item, lastMessage: content, lastMessageAt: message.sentAt, time: message.sentAt } : item));
    } catch (e: any) {
      setError(e.message || "Erro ao enviar midia");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await sendMedia(file, file.name);
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        await sendMedia(blob, `audio-${Date.now()}.webm`, "Audio");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e: any) {
      setError(e.message || "Microfone indisponivel");
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeChat || !messageId) return;
    try {
      await api.deleteConversationMessage(activeChat.id, messageId);
      setActiveChat((chat: any) => ({
        ...chat,
        messages: (chat.messages || []).filter((message: any) => message.id !== messageId),
      }));
    } catch (e: any) {
      setError(e.message || "Erro ao excluir mensagem");
    }
  };

  const suggestReply = () => {
    if (!activeChat) return;
    const lastInbound = [...(activeChat.messages || [])].reverse().find((message: any) => message.senderType === "contact");
    setDraft(lastInbound?.content
      ? `Obrigado pelo contato. Sobre "${lastInbound.content.slice(0, 80)}", vou verificar e ja retorno com a melhor solucao.`
      : "Obrigado pelo contato. Vou verificar as informacoes e ja retorno.");
  };

  const createTicketFromConversation = async () => {
    if (!activeChat) return;
    try {
      await api.createTicket({
        title: `Atendimento - ${activeChat.name}`,
        description: activeChat.lastMessage || "Ticket criado a partir da conversa.",
        contactId: activeChat.contactId,
        contactName: activeChat.name,
        contactEmail: activeChat.email,
        contactPhone: activeChat.phone,
        priority: activeChat.priority || "normal",
      });
      setError("Ticket criado com sucesso.");
    } catch (e: any) {
      setError(e.message || "Erro ao criar ticket");
    }
  };

  const showAiSummary = () => {
    if (!activeChat) return;
    const recent = (activeChat.messages || []).slice(-5).map((message: any) => message.content).filter(Boolean).join(" ");
    setError(recent ? `Resumo: ${recent.slice(0, 220)}` : "Sem mensagens suficientes para resumir.");
  };

  const formatTime = (value?: string) => {
    if (!value) return "";
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "whatsmeow":
      case "whatsapp": return <Smartphone className="w-3 h-3 text-white" />;
      case "wahaplus": return <Cpu className="w-3 h-3 text-white" />;
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
      case "wahaplus": return "bg-purple-600";
      case "instagram": return "bg-pink-500";
      case "web":
      case "webchat": return "bg-blue-500";
      case "email": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const participantLabel = (message: any) => {
    const value = message.metadata?.senderName || message.metadata?.senderPhone || "";
    if (String(value).includes("@lid")) return message.metadata?.senderPhone || "Participante";
    return value || "Participante";
  };

  const renderMedia = (message: any, outbound: boolean) => {
    const url = message.mediaUrl || message.metadata?.storedMedia?.url;
    const mimeType = message.mediaMimeType || message.metadata?.storedMedia?.mimeType || "";
    const name = message.mediaName || message.metadata?.storedMedia?.name || "Arquivo";
    if (!url) return null;
    if (mimeType.startsWith("image/") || message.messageType === "sticker") {
      return <img src={url} alt={name} className="mt-2 max-h-72 rounded-lg object-contain border border-black/5" />;
    }
    if (mimeType.startsWith("audio/")) {
      return <audio controls src={url} className="mt-2 w-64 max-w-full" />;
    }
    if (mimeType === "application/pdf") {
      return (
        <a href={url} target="_blank" rel="noreferrer" className={cn("mt-2 flex items-center gap-2 rounded-lg border p-3 text-xs font-bold", outbound ? "border-white/20 bg-white/10 text-white" : "border-border bg-bg text-text")}>
          <FileText className="w-4 h-4" /> {name}
          <Download className="w-4 h-4 ml-auto" />
        </a>
      );
    }
    return (
      <a href={url} target="_blank" rel="noreferrer" className={cn("mt-2 flex items-center gap-2 rounded-lg border p-3 text-xs font-bold", outbound ? "border-white/20 bg-white/10 text-white" : "border-border bg-bg text-text")}>
        <ImageIcon className="w-4 h-4" /> {name}
        <Download className="w-4 h-4 ml-auto" />
      </a>
    );
  };

  return (
    <div className="h-[calc(100vh-100px)] lg:h-[calc(100vh-160px)] flex bg-surface lg:rounded-2xl border border-border overflow-hidden card-shadow">
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
                {chat.avatarUrl ? (
                  <img src={chat.avatarUrl} alt={chat.name} className="w-12 h-12 rounded-full object-cover border border-border shadow-sm" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-bg border border-border flex items-center justify-center font-bold text-muted text-lg shadow-sm">
                    {(chat.name || "?").charAt(0)}
                  </div>
                )}
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
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setView("list")} className="lg:hidden p-2 -ml-2 text-muted hover:text-text">
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            {activeChat?.avatarUrl ? (
              <img src={activeChat.avatarUrl} alt={activeChat.name} className="w-10 h-10 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center font-bold text-muted">
                {activeChat ? activeChat.name.charAt(0) : "?"}
              </div>
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm flex items-center gap-2 min-w-0">
                {editingName && activeChat ? (
                  <div className="flex items-center gap-1">
                    <input
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      className="h-8 w-44 rounded-lg border border-border px-2 text-sm outline-none focus:border-primary"
                      autoFocus
                    />
                    <button onClick={saveLeadName} className="p-1.5 rounded-lg hover:bg-bg text-primary" title="Salvar nome">
                      <CheckCheck className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditingName(false); setLeadName(activeChat.name || ""); }} className="p-1.5 rounded-lg hover:bg-bg text-muted" title="Cancelar">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="truncate">{activeChat?.name || "Selecione uma conversa"}</span>
                    {activeChat && (
                      <button onClick={startEditingName} className="p-1 rounded-md hover:bg-bg text-muted" title="Editar nome do lead">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </>
                )}
                {activeChat?.status === "active" && <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Ativa" />}
              </div>
              <p className="text-[11px] text-muted">
                {activeChat ? `${activeChat.isGroup ? "Grupo" : "Privada"} · ${activeChat.instance?.name || activeChat.channel}` : "Aguardando selecao"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeChat?.phone && (
              <CallActionButton
                phone={activeChat.phone}
                source="inbox-header"
                label="Ligar"
                className="hidden sm:inline-flex"
              />
            )}
            <button onClick={suggestReply} className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-bold text-muted hover:text-primary transition-all shadow-sm">
              <Bot className="w-4 h-4" /> Sugerir Resposta
            </button>
            <button className="p-2 rounded-xl hover:bg-bg text-muted transition-all lg:hidden" onClick={openInfoPanel}>
              <Info className="w-5 h-5" />
            </button>
            <button onClick={openInfoPanel} className="hidden lg:flex p-2 rounded-xl hover:bg-bg text-muted transition-all">
              <MoreVertical className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-24 pb-6 px-4 lg:px-8 space-y-4 custom-scrollbar bg-[#ECE5DD]">
          {activeChat ? (
            (activeChat.messages || []).length > 0 ? (
              activeChat.messages.map((message: any) => {
                const outbound = message.senderType !== "contact";
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex flex-col max-w-[80%] lg:max-w-[70%]",
                      outbound ? "items-end ml-auto" : "items-start",
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-2xl shadow-sm text-sm relative group/message",
                      outbound
                        ? "bg-primary text-white rounded-tr-sm"
                        : "bg-white border border-border text-text rounded-tl-sm",
                    )}>
                      <button
                        type="button"
                        onClick={() => deleteMessage(message.id)}
                        className={cn(
                          "absolute -top-2 opacity-0 group-hover/message:opacity-100 transition-all p-1 rounded-lg border shadow-sm",
                          outbound
                            ? "-left-2 bg-white text-red-500 border-red-100"
                            : "-right-2 bg-white text-red-500 border-red-100",
                        )}
                        title="Excluir mensagem"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {!outbound && activeChat?.isGroup && (
                        <div className="text-[11px] font-bold text-[#128C7E] mb-1">
                          {participantLabel(message)}
                        </div>
                      )}
                      {outbound && message.senderType === "ai" && (
                        <div className="flex items-center gap-1.5 mb-1.5 opacity-80 border-b border-white/20 pb-1.5">
                          <Bot className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Agente IA</span>
                        </div>
                      )}
                      {message.content && <div className="whitespace-pre-wrap break-words">{message.content}</div>}
                      {renderMedia(message, outbound)}
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
            {activeChat.phone && (
              <CallActionButton
                phone={activeChat.phone}
                source="inbox-actions"
                label="Ligar"
                className="shrink-0"
              />
            )}
            <button onClick={createTicketFromConversation} className="shrink-0 px-3 py-1.5 bg-bg hover:bg-surface border border-border rounded-lg text-xs font-bold text-muted flex items-center gap-1 transition-all">
              <Ticket className="w-3 h-3" /> Criar Ticket
            </button>
            <button onClick={showAiSummary} className="shrink-0 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-xs font-bold text-primary flex items-center gap-1 transition-all">
              <Bot className="w-3 h-3" /> Resumo IA
            </button>
          </div>
        )}

        <div className="p-4 bg-white">
          <div className="flex items-end gap-2 bg-bg border border-border rounded-2xl p-2 focus-within:border-primary/50 focus-within:ring-2 ring-primary/10 transition-all shadow-sm">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
              accept="image/*,audio/*,video/mp4,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl hover:bg-surface text-muted shrink-0 disabled:opacity-50"
              disabled={!activeChat || uploading}
              title="Anexar arquivo"
            >
              <Paperclip className="w-5 h-5" />
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
              placeholder={recording ? "Gravando audio..." : uploading ? "Enviando arquivo..." : "Digite sua mensagem..."}
              className="flex-1 bg-transparent border-none outline-none text-sm py-2 max-h-32 min-h-[40px] resize-none custom-scrollbar"
              disabled={!activeChat || sending || uploading || recording}
              rows={1}
            />
            <button
              type="button"
              onClick={toggleRecording}
              className={cn(
                "p-2.5 rounded-xl transition-all shrink-0 disabled:opacity-50",
                recording ? "bg-red-500 text-white" : "hover:bg-surface text-muted",
              )}
              disabled={!activeChat || uploading}
              title={recording ? "Parar gravacao" : "Gravar audio"}
            >
              {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={sendMessage}
              className="bg-primary text-white p-2.5 rounded-xl hover:scale-105 transition-all shadow-md disabled:opacity-50"
              disabled={!activeChat || !draft.trim() || sending || uploading || recording}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {activeChat && view === "info" && (
      <div className="w-full lg:w-[320px] border-l border-border bg-white absolute inset-0 lg:static z-20 overflow-y-auto custom-scrollbar shadow-xl lg:shadow-none">
        <div className="flex items-center justify-between p-4 border-b border-border bg-white sticky top-0 z-10">
          <button onClick={closeInfoPanel} className="p-2 -ml-2 text-muted hover:text-text" title="Fechar detalhes">
            <X className="w-5 h-5" />
          </button>
          <h3 className="font-bold text-sm">Contato 360</h3>
          <div className="w-10" />
        </div>

          <div className="p-6 space-y-8">
            <div className="flex flex-col items-center text-center">
              {activeChat.avatarUrl ? (
                <img src={activeChat.avatarUrl} alt={activeChat.name} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg mb-4" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 border-4 border-white shadow-lg flex items-center justify-center text-3xl font-display font-bold text-primary mb-4">
                  {activeChat.name.charAt(0)}
                </div>
              )}
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xl text-text">{activeChat.name}</h4>
                <button onClick={startEditingName} className="p-1.5 rounded-lg hover:bg-bg text-muted" title="Editar nome do lead">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-muted mb-3">Instância: {activeChat.instance?.name || activeChat.channel}</p>
              <div className="flex gap-2 w-full">
                <button onClick={() => navigate(`/app/contacts?search=${encodeURIComponent(activeChat.name)}`)} className="flex-1 py-2 bg-bg border border-border rounded-xl text-xs font-bold hover:bg-surface transition-all flex items-center justify-center gap-2">
                  <User className="w-4 h-4" /> Perfil
                </button>
                <button onClick={showAiSummary} className="flex-1 py-2 bg-primary/10 border border-primary/20 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
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
                  <p className="text-sm font-bold truncate">{activeChat.phone ? formatPhoneForDisplay(activeChat.phone) : "Nao informado"}</p>
                </div>
                {activeChat.phone && (
                  <CallActionButton
                    phone={activeChat.phone}
                    source="inbox-contact-details"
                    compact
                  />
                )}
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
      </div>
      )}
    </div>
  );
}
