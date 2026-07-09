import { useState, useEffect } from "react";
import { PhoneOff, Phone, Clock } from "lucide-react";
import type { CallRecord } from "../../types/calls";
import { preferredCallPeer } from "../../lib/phone";

interface ActiveCallProps {
  call: CallRecord
  onEndCall: () => void
}

function formatDuration(startedAt: number) {
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function CallTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(() => formatDuration(startedAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatDuration(startedAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return <>{elapsed}</>;
}

export function ActiveCall({ call, onEndCall }: ActiveCallProps) {
  const peer = preferredCallPeer(call) || "Telefone nao resolvido";

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Phone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{call.pushName || peer}</p>
            {call.pushName && <p className="text-xs text-muted">{peer}</p>}
            <div className="flex items-center gap-1 text-xs text-muted">
              <Clock className="w-3 h-3" />
              <CallTimer startedAt={call.startedAt} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
            call.status === "connected"
              ? "bg-green-50 text-green-700"
              : call.status === "ringing"
              ? "bg-yellow-50 text-yellow-700"
              : "bg-blue-50 text-blue-700"
          }`}>
            {call.status === "connected" ? "Ativo" : call.status === "ringing" ? "Chamando" : "Iniciando"}
          </span>
          <button
            onClick={onEndCall}
            className="p-2.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
