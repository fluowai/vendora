import { PhoneIncoming, PhoneOutgoing, Clock } from "lucide-react";
import type { CallRecord } from "../../types/calls";
import { preferredCallPeer } from "../../lib/phone";

interface CallHistoryProps {
  records: CallRecord[]
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function CallHistory({ records }: CallHistoryProps) {
  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-sm">
        Nenhuma chamada no histórico
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map((r) => (
        <div key={r.callId} className="flex items-center gap-3 p-3 rounded-xl bg-bg border border-border">
          <div className={`p-2 rounded-full ${
            r.direction === "inbound" ? "bg-green-50" : "bg-blue-50"
          }`}>
            {r.direction === "inbound"
              ? <PhoneIncoming className="w-4 h-4 text-green-600" />
              : <PhoneOutgoing className="w-4 h-4 text-blue-600" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{preferredCallPeer(r) || "Telefone nao resolvido"}</p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <Clock className="w-3 h-3" />
              <span>{formatDate(r.startedAt)}</span>
              {r.ownerName && <span>• {r.ownerName}</span>}
            </div>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
            r.endReason === "user_ended" || r.endReason === "declined"
              ? "bg-red-50 text-red-600"
              : "bg-green-50 text-green-600"
          }`}>
            {r.endReason === "user_ended" ? "Encerrada" :
             r.endReason === "declined" ? "Recusada" :
             r.endReason === "failed" ? "Falhou" :
             r.endReason === "timeout" ? "Sem resposta" : "Finalizada"}
          </span>
        </div>
      ))}
    </div>
  );
}
