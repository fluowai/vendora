import { Phone, PhoneOff } from "lucide-react";

interface IncomingCallProps {
  peer: string
  onAccept: () => void
  onReject: () => void
}

export function IncomingCall({ peer, onAccept, onReject }: IncomingCallProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center animate-pulse">
          <Phone className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">Chamada Recebida</p>
          <p className="text-muted mt-1">+{peer.replace(/@.+$/, "")}</p>
        </div>
        <div className="flex justify-center gap-4">
          <button
            onClick={onReject}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
          >
            <PhoneOff className="w-6 h-6" />
          </button>
          <button
            onClick={onAccept}
            className="p-4 bg-primary text-white rounded-full hover:bg-primary/90 transition-all"
          >
            <Phone className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
