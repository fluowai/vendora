import { 
  Send, 
  Paperclip, 
  Smile, 
  Mic, 
  Phone, 
  Video, 
  Info, 
  Search,
  CheckCheck,
  Smartphone,
  Instagram,
  User,
  Hash,
  Bot,
  Plus,
  MessageSquare
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/src/lib/utils";

const chats = [
  { id: '1', name: 'João Silva', lastMessage: 'Olá, gostaria de saber mais.', time: '10:30', unread: 2, channel: 'whatsapp', status: 'online' },
  { id: '2', name: 'Maria Souza', lastMessage: 'Como funciona o plano Growth?', time: '09:45', unread: 0, channel: 'instagram', status: 'offline' },
  { id: '3', name: 'Eduardo Lima', lastMessage: 'Ok, vou enviar o comprovante.', time: 'Ontem', unread: 0, channel: 'whatsapp', status: 'online' },
  { id: '4', name: 'Soul Tech', lastMessage: 'Agent: Olá! Como posso ajudar?', time: 'Ontem', unread: 0, channel: 'whatsapp', status: 'ai' },
];

export default function Inbox() {
  const [activeChat, setActiveChat] = useState<any>(null);
  const [view, setView] = useState<'list' | 'chat' | 'info'>('list');

  // Handle mobile view transitions
  useEffect(() => {
    if (activeChat && window.innerWidth < 1024) {
      setView('chat');
    }
  }, [activeChat]);

  return (
    <div className="h-[calc(100vh-100px)] lg:h-[calc(100vh-160px)] flex bg-surface lg:rounded-[2.5rem] border-t lg:border border-border overflow-hidden card-shadow -mx-4 lg:mx-0">
      {/* Sidebar - Chats List */}
      <div className={cn(
        "w-full lg:w-80 border-r border-border flex flex-col bg-surface transition-all duration-300",
        view !== 'list' && "hidden lg:flex"
      )}>
        <div className="p-4 lg:p-6 border-b border-border">
          <div className="relative mb-4 lg:mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
              type="text" 
              placeholder="Buscar conversas..."
              className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-xs outline-none focus:border-primary/50 transition-all text-text"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button className="shrink-0 px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-bold rounded-lg border border-primary/20">TODOS</button>
            <button className="shrink-0 px-3 py-1.5 bg-[#F1F5F9] text-muted text-[10px] font-bold rounded-lg hover:bg-primary/5 hover:text-primary transition-all">NÃO LIDAS</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {chats.map((chat) => (
            <button 
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={cn(
                "w-full p-4 flex items-start gap-3 border-b border-border hover:bg-bg transition-all text-left",
                activeChat?.id === chat.id && "bg-primary/5 border-l-4 border-l-primary"
              )}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center font-bold text-muted border border-border">
                  {chat.name.charAt(0)}
                </div>
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-surface flex items-center justify-center",
                  chat.channel === 'whatsapp' ? 'bg-[#25D366]' : 'bg-pink-500'
                )}>
                  {chat.channel === 'whatsapp' ? <Smartphone className="w-2 h-2 text-white" /> : <Instagram className="w-2 h-2 text-white" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-bold text-sm truncate">{chat.name}</h4>
                  <span className="text-[10px] text-muted">{chat.time}</span>
                </div>
                <p className="text-xs text-muted truncate">{chat.lastMessage}</p>
              </div>
              {chat.unread > 0 && (
                <div className="bg-primary text-white text-[10px] font-bold w-5 h-5 rounded-lg flex items-center justify-center shrink-0">
                  {chat.unread}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col bg-bg/30 transition-all duration-300",
        view === 'chat' ? 'flex' : view === 'list' ? 'hidden lg:flex' : 'hidden lg:flex'
      )}>
        {/* Chat Header */}
        <div className="h-16 lg:h-20 border-b border-border px-4 lg:px-8 flex items-center justify-between bg-surface/50">
          <div className="flex items-center gap-3 lg:gap-4">
            <button 
              onClick={() => setView('list')}
              className="lg:hidden p-2 -ml-2 text-muted hover:text-text transition-colors"
            >
              <ChevronRight className="w-6 h-6 rotate-180" />
            </button>
            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-[#F1F5F9] flex items-center justify-center font-bold text-muted border border-border">
              {activeChat ? activeChat.name.charAt(0) : '?'}
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                {activeChat?.name || 'Selecione uma conversa'}
                {activeChat?.status === 'online' && <div className="w-2 h-2 rounded-full bg-primary" />}
                {activeChat?.status === 'ai' && <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-bold rounded">BOT</span>}
              </h3>
              <p className="text-[10px] text-muted">WhatsApp Business</p>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:gap-2">
            <button className="hidden sm:p-2.5 rounded-xl hover:bg-bg text-muted transition-all"><Phone className="w-5 h-5" /></button>
            <button className="p-2.5 rounded-xl hover:bg-bg text-muted transition-all lg:hidden" onClick={() => setView('info')}><Info className="w-5 h-5" /></button>
            <button className="hidden lg:p-2.5 rounded-xl hover:bg-bg text-muted transition-all"><Info className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 custom-scrollbar bg-[#F8FAFC]">
          {activeChat ? (
            <>
              <div className="flex justify-center">
                <span className="px-3 py-1 bg-white/50 backdrop-blur-sm rounded-lg text-[10px] text-muted font-bold uppercase tracking-widest border border-border">Hoje</span>
              </div>
              
              <div className="chat-bubble-received">
                Olá! Vi seu anúncio e gostaria de saber se vocês entregam em São Paulo.
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className="text-[10px] text-muted">10:30</span>
              </div>

              <div className="chat-bubble-sent">
                <div className="flex items-center gap-1.5 mb-1 opacity-60">
                  <Bot className="w-3 h-3" />
                  <span className="text-[10px] font-bold uppercase tracking-tighter">Vendaora AI</span>
                </div>
                Olá {activeChat.name}! Sim, entregamos em toda a Grande São Paulo com frete grátis para pedidos acima de R$ 200. Posso te ajudar com o catálogo?
              </div>
              <div className="flex items-center gap-2 justify-end mr-3">
                <span className="text-[10px] text-muted">10:31</span>
                <CheckCheck className="w-3 h-3 text-primary" />
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-display font-bold mb-2">Suas conversas aparecem aqui</h3>
              <p className="text-muted max-w-xs mx-auto text-sm">Selecione um contato na lista lateral para iniciar ou continuar um atendimento.</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-surface/50 border-t border-border">
          <div className="flex items-center gap-2 lg:gap-4 bg-bg border border-border rounded-2xl p-1.5 lg:p-2 pl-4">
            <button className="p-2 rounded-xl hover:bg-surface text-muted hidden sm:block"><Paperclip className="w-5 h-5" /></button>
            <input 
              type="text" 
              placeholder="Escreva sua mensagem..."
              className="flex-1 bg-transparent border-none outline-none text-sm py-2"
              disabled={!activeChat}
            />
            <div className="flex items-center gap-1 px-1 lg:px-2 border-l border-border">
              <button className="p-2 rounded-xl hover:bg-surface text-muted"><Smile className="w-5 h-5" /></button>
            </div>
            <button className="bg-primary text-white p-3 rounded-xl hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100" disabled={!activeChat}>
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Sidebar */}
      <div className={cn(
        "w-full lg:w-72 border-l border-border bg-surface p-6 absolute inset-0 lg:static z-20 transition-all duration-300",
        view === 'info' ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
        !activeChat && "hidden lg:block opacity-50 pointer-events-none"
      )}>
        <div className="flex items-center justify-between lg:hidden mb-6">
          <button onClick={() => setView('chat')} className="p-2 -ml-2 text-muted">
            <ChevronRight className="w-6 h-6 rotate-180" />
          </button>
          <h3 className="font-bold text-sm">Detalhes</h3>
          <div className="w-10" />
        </div>
        <h3 className="hidden lg:block font-bold text-sm mb-6 uppercase tracking-widest text-muted">Detalhes do Contato</h3>
        
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center pb-6 border-b border-border">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-2xl font-bold text-primary mb-4 shadow-inner">
              {activeChat?.name.charAt(0)}
            </div>
            <h4 className="font-bold text-lg text-text">{activeChat?.name}</h4>
            <p className="text-xs text-muted flex items-center gap-1 mt-1 font-medium">
              <Smartphone className="w-3 h-3 text-primary" /> +55 11 99887-7665
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3 flex items-center justify-between">
              Tags do CRM
              <Plus className="w-3 h-3 cursor-pointer hover:text-primary transition-colors" />
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-lg border border-primary/20">WHATSAPP</span>
              <span className="px-2 py-1 bg-[#38BDF8]/10 text-[#38BDF8] text-[10px] font-bold rounded-lg border-[#38BDF8]/20">QUALIFICADO</span>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Etapa do Funil</p>
            <div className="p-3 bg-bg border border-border rounded-xl flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-all shadow-sm">
              <span className="text-xs font-bold">Em Atendimento</span>
              <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary transition-all" />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
             <button className="w-full py-3 bg-[#128C7E]/10 text-[#128C7E] rounded-xl text-xs font-bold hover:bg-[#128C7E]/20 transition-all flex items-center justify-center gap-2">
               Abrir Oportunidade
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRight(props: any) {
  return <path {...props} d="m9 18 6-6-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
}
