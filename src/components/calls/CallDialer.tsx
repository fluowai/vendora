import { useState } from "react";
import { Phone, Loader2 } from "lucide-react";

interface CallDialerProps {
  onStartCall: (phone: string) => Promise<void>
  calling: boolean
}

export function CallDialer({ onStartCall, calling }: CallDialerProps) {
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || calling) return;
    await onStartCall(phone.trim());
    setPhone("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
        placeholder="5521999999999"
        className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-bg text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        disabled={calling}
      />
      <button
        type="submit"
        disabled={!phone.trim() || calling}
        className="px-5 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      >
        {calling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
        {calling ? "Chamando..." : "Ligar"}
      </button>
    </form>
  );
}
