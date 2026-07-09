import { useState, useEffect } from "react"
import { Bot, X, Send, MessageSquare } from "lucide-react"
import { api } from "@/src/lib/api"

interface WidgetConfig {
  agentId: string
  primaryColor?: string
  title?: string
  subtitle?: string
  position?: 'bottom-right' | 'bottom-left'
}

// This component renders the embeddable chat widget
// To embed: <script src="https://yourdomain.com/api/public/widget.js" data-agent-id="agent-id" data-color="#25D366"></script>
export function WidgetPreview({ config }: { config: WidgetConfig }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [loading, setLoading] = useState(false)

  const sendMessage = async () => {
    if (!message.trim()) return
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    setLoading(true)
    try {
      const res = await api.chatWithAgent(config.agentId, message)
      setMessages((prev) => [...prev, { role: 'agent', content: res.response }])
    } catch {
      setMessages((prev) => [...prev, { role: 'agent', content: 'Desculpe, ocorreu um erro.' }])
    }
    setMessage('')
    setLoading(false)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {open && (
        <div className="absolute bottom-20 right-0 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="p-4 flex items-center gap-3 border-b" style={{ backgroundColor: config.primaryColor || '#25D366' }}>
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">{config.title || 'Assistente Virtual'}</p>
              <p className="text-white/70 text-[10px]">{config.subtitle || 'Online'}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-center py-10">
                <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Olá! Como posso ajudar?</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-gray-200 text-gray-800'
                    : 'text-white'
                }`} style={msg.role === 'agent' ? { backgroundColor: config.primaryColor || '#25D366' } : {}}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 rounded-2xl px-4 py-2.5 text-sm text-gray-500">
                  <span className="animate-pulse">Digitando...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !message.trim()}
                className="p-2.5 rounded-xl text-white disabled:opacity-50"
                style={{ backgroundColor: config.primaryColor || '#25D366' }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-all text-white"
        style={{ backgroundColor: config.primaryColor || '#25D366' }}
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </div>
  )
}

// Generator for embed code
export function generateEmbedCode(agentId: string, color = '#25D366'): string {
  return `<!-- Vendaora 360 - AI Agent Widget -->
<script src="${window.location.origin}/api/public/widget.js" data-agent-id="${agentId}" data-color="${color}" async></script>
<!-- End Vendaora 360 Widget -->`
}
