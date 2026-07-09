import { Loader2, Phone, PhoneOff } from "lucide-react";
import { preferredCallPeer } from "../../lib/phone";

interface IncomingCallProps {
  peer: string
  callerPn?: string | null
  pushName?: string | null
  avatarUrl?: string | null
  onAccept: () => void
  onReject: () => void
  accepting?: boolean
  rejecting?: boolean
  error?: string | null
}

export function IncomingCall({ peer, callerPn, pushName, avatarUrl, onAccept, onReject, accepting = false, rejecting = false, error }: IncomingCallProps) {
  const busy = accepting || rejecting;
  const displayPhone = preferredCallPeer({ peer, callerPn }) || "Telefone nao resolvido";
  const displayName = pushName || "Chamada recebida";
  const fallbackInitial = (pushName || displayPhone || "?").charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto flex items-center justify-center animate-pulse overflow-hidden border border-primary/20">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : pushName ? (
            <span className="text-2xl font-bold text-primary">{fallbackInitial}</span>
          ) : (
            <Phone className="w-8 h-8 text-primary" />
          )}
        </div>
        <div>
          <p className="text-2xl font-bold">Chamada Recebida</p>
          <p className="text-sm font-semibold text-text mt-2">{displayName}</p>
          <p className="text-muted mt-1">{displayPhone}</p>
        </div>
        {error && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-center gap-4">
          <button
            onClick={onReject}
            disabled={busy}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {rejecting ? <Loader2 className="w-6 h-6 animate-spin" /> : <PhoneOff className="w-6 h-6" />}
          </button>
          <button
            onClick={onAccept}
            disabled={busy}
            className="p-4 bg-primary text-white rounded-full hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {accepting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Phone className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </div>
  );
}
