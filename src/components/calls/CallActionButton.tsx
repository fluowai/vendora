import { PhoneCall } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { formatPhoneForDisplay, normalizePhoneForCall } from "../../lib/phone";

interface CallActionButtonProps {
  phone?: string | null
  label?: string
  source?: string
  className?: string
  compact?: boolean
}

export function requestPabxCall(phone: string, source?: string) {
  window.dispatchEvent(new CustomEvent("pabx:start-call", {
    detail: { phone: normalizePhoneForCall(phone), source },
  }));
}

export function CallActionButton({ phone, label, source, className, compact = false }: CallActionButtonProps) {
  const normalized = normalizePhoneForCall(phone);
  const disabled = !normalized;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (normalized) requestPabxCall(normalized, source);
      }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
        compact
          ? "h-8 px-2 text-[11px]"
          : "h-9 px-3 text-xs",
        disabled
          ? "border-border bg-bg text-muted"
          : "border-primary/20 bg-primary/10 text-primary hover:bg-primary/20",
        className,
      )}
      title={normalized ? `Ligar para ${formatPhoneForDisplay(normalized)}` : "Telefone nao informado"}
    >
      <PhoneCall className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      {!compact && (label || "Ligar")}
    </button>
  );
}

