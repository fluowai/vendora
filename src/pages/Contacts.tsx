import { 
  Search, Filter, Plus, User, Smartphone, Mail, Instagram, Globe, 
  MapPin, Building, Tag, Activity, MessageSquare, Ticket, ShieldAlert,
  CreditCard, ChevronRight, Download, MoreHorizontal, Bot
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/src/lib/utils";

// Mock Data
const mockContacts = [
  { id: '1', name: 'João Silva', phone: '+55 11 98888-7777', email: 'joao.silva@email.com', company: 'Empresa XPTO', city: 'São Paulo, SP', score: 85, tags: ['VIP', 'Quente'], lastActive: 'Hoje', avatar: 'J', status: 'active' },
  { id: '2', name: 'Maria Souza', phone: '+55 11 97777-6666', email: 'maria.souza@email.com', company: 'Tech Solutions', city: 'Rio de Janeiro, RJ', score: 60, tags: ['Suporte'], lastActive: 'Ontem', avatar: 'M', status: 'active' },
  { id: '3', name: 'Eduardo Lima', phone: '+55 11 96666-5555', email: 'eduardo.lima@email.com', company: 'Logistics BR', city: 'Curitiba, PR', score: 90, tags: ['Financeiro'], lastActive: 'Há 2 dias', avatar: 'E', status: 'inactive' },
];

export default function Contacts() {
  const [selectedContact, setSelectedContact] = useState<any>(mockContacts[0]);

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      
      {/* Esquerda: Lista de Contatos */}
      <div className="w-full lg:w-1/3 flex flex-col space-y-4 bg-white rounded-[2rem] border border-border p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-display font-bold text-text mb-1">Contatos 360</h1>
          <p className="text-muted text-sm mb-6">Visão unificada de clientes.</p>
          
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input 
                type="text" 
                placeholder="Buscar por nome, telefone..."
                className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm outline-none focus:border-primary/50 transition-all"
              />
            </div>
            <button className="p-2.5 bg-bg border border-border rounded-xl hover:bg-surface transition-all">
              <Filter className="w-5 h-5 text-muted" />
            </button>
          </div>
          <button className="w-full bg-primary text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> Novo Contato
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-6 px-6 border-t border-border pt-4">
          <div className="space-y-2">
            {mockContacts.map(contact => (
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
                  <p className="text-xs text-muted flex items-center gap-1"><Building className="w-3 h-3"/> {contact.company}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-muted font-bold">{contact.lastActive}</span>
                  <span className={cn(
                    "w-2 h-2 rounded-full",
                    contact.status === 'active' ? "bg-green-500" : "bg-gray-300"
                  )} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Direita: Detalhe do Contato (Ficha 360) */}
      {selectedContact ? (
        <div className="w-full lg:w-2/3 flex flex-col bg-white rounded-[2rem] border border-border overflow-hidden shadow-sm">
          
          {/* Header Profile */}
          <div className="relative p-8 pb-0 flex flex-col lg:flex-row items-center lg:items-start gap-6 border-b border-border bg-gradient-to-b from-bg to-white pt-12 lg:pt-8">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button className="px-4 py-2 bg-white border border-border rounded-xl text-xs font-bold text-muted hover:text-text transition-all flex items-center gap-2">
                <Download className="w-4 h-4"/> Exportar
              </button>
              <button className="p-2 bg-white border border-border rounded-xl text-muted hover:text-text transition-all">
                <MoreHorizontal className="w-5 h-5"/>
              </button>
            </div>

            <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-3xl bg-white border-4 border-white shadow-xl flex items-center justify-center font-display text-4xl lg:text-5xl text-primary font-bold z-10">
              {selectedContact.avatar}
            </div>
            
            <div className="flex-1 text-center lg:text-left z-10 mb-6">
              <h2 className="text-2xl lg:text-3xl font-bold font-display text-text mb-2">{selectedContact.name}</h2>
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm text-muted mb-4 font-medium">
                <span className="flex items-center gap-1"><Building className="w-4 h-4"/> {selectedContact.company}</span>
                <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {selectedContact.city}</span>
              </div>
              
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                <div className="flex items-center gap-1 px-3 py-1 bg-green-50 text-green-600 rounded-lg text-xs font-bold border border-green-100">
                  <Activity className="w-3 h-3" /> Score {selectedContact.score}
                </div>
                {selectedContact.tags.map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-bg border border-border rounded-lg text-xs font-bold text-muted uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3 h-3"/> {tag}
                  </span>
                ))}
                <button className="p-1 hover:bg-bg rounded text-muted transition-colors"><Plus className="w-4 h-4"/></button>
              </div>
            </div>
          </div>

          {/* Tab Navigation (Visual Only) */}
          <div className="px-8 flex items-center gap-6 border-b border-border overflow-x-auto no-scrollbar">
            {['Visão Geral', 'Conversas', 'Oportunidades', 'Tickets', 'Ouvidoria', 'Arquivos'].map((tab, i) => (
              <button key={tab} className={cn(
                "py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap",
                i === 0 ? "border-primary text-primary" : "border-transparent text-muted hover:text-text"
              )}>
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-[#F8FAFC]">
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Card Contato */}
              <div className="bg-white p-6 rounded-2xl border border-border shadow-sm">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2"><User className="w-4 h-4"/> Dados Pessoais</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center"><Smartphone className="w-5 h-5 text-muted"/></div>
                    <div><p className="text-[10px] text-muted font-bold uppercase">WhatsApp / Telefone</p><p className="font-medium text-sm">{selectedContact.phone}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center"><Mail className="w-5 h-5 text-muted"/></div>
                    <div><p className="text-[10px] text-muted font-bold uppercase">E-mail</p><p className="font-medium text-sm">{selectedContact.email}</p></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-bg flex items-center justify-center"><Instagram className="w-5 h-5 text-muted"/></div>
                    <div><p className="text-[10px] text-muted font-bold uppercase">Instagram</p><p className="font-medium text-sm text-primary cursor-pointer">@joaosilva.oficial</p></div>
                  </div>
                </div>
              </div>

              {/* Card Resumo IA */}
              <div className="bg-gradient-to-br from-[#E8F6F0] to-white p-6 rounded-2xl border border-primary/20 shadow-sm relative overflow-hidden">
                <Bot className="absolute -bottom-4 -right-4 w-32 h-32 text-primary/5 rotate-[-15deg]" />
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2"><Bot className="w-4 h-4"/> Resumo da IA</h3>
                <p className="text-sm text-text/80 leading-relaxed mb-4 relative z-10">
                  Cliente entrou em contato demonstrando alto interesse nos planos empresariais. Já teve um ticket de suporte resolvido rapidamente no mês passado. Perfil com alta probabilidade de conversão (Upsell).
                </p>
                <div className="relative z-10 bg-white/60 p-3 rounded-xl border border-white">
                  <p className="text-[10px] font-bold uppercase text-muted mb-1">Próxima Ação Sugerida</p>
                  <p className="text-xs font-bold text-primary flex items-center gap-2">Enviar proposta do Plano Growth <ChevronRight className="w-3 h-3"/></p>
                </div>
              </div>
            </div>

            {/* Linha do Tempo / Histórico */}
            <div>
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Últimas Interações</h3>
              <div className="bg-white border border-border rounded-2xl shadow-sm p-2">
                
                <div className="flex items-start gap-4 p-4 hover:bg-bg rounded-xl transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center shrink-0"><MessageSquare className="w-5 h-5"/></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm">Conversa via WhatsApp</h4>
                      <span className="text-[10px] text-muted">Há 2 horas</span>
                    </div>
                    <p className="text-xs text-muted">Atendido por <span className="font-bold">Agente IA (SDR)</span>. Lead qualificado.</p>
                  </div>
                </div>
                
                <div className="h-px bg-border mx-4" />

                <div className="flex items-start gap-4 p-4 hover:bg-bg rounded-xl transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0"><CreditCard className="w-5 h-5"/></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm">Oportunidade Fechada</h4>
                      <span className="text-[10px] text-muted">05/05/2026</span>
                    </div>
                    <p className="text-xs text-muted">Contrato assinado - Plano Starter (R$ 499/mês).</p>
                  </div>
                </div>

                <div className="h-px bg-border mx-4" />

                <div className="flex items-start gap-4 p-4 hover:bg-bg rounded-xl transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><Ticket className="w-5 h-5"/></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm">Ticket #1024 Resolvido</h4>
                      <span className="text-[10px] text-muted">15/04/2026</span>
                    </div>
                    <p className="text-xs text-muted">Dúvida sobre integração de webhook esclarecida pelo Suporte.</p>
                  </div>
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
            <p className="text-sm">Para visualizar a Ficha 360 completa.</p>
          </div>
        </div>
      )}
      
    </div>
  );
}
