import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
    cancelled: "Cancelado",
    completed: "Concluido",
    no_show: "Nao compareceu",
  };
  return labels[status] || status;
}

export default function CalendarPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const nextAppointment = useMemo(() => {
    return appointments.find((appointment) => ["scheduled", "confirmed"].includes(appointment.status));
  }, [appointments]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const inThirtyDays = new Date(now);
      inThirtyDays.setDate(now.getDate() + 30);
      const [appointmentsData, slotsData] = await Promise.all([
        api.getAppointments({ from: now.toISOString(), to: inThirtyDays.toISOString() }),
        api.getAvailableSlots({ from: now.toISOString(), days: 14, limit: 8 }),
      ]);
      setAppointments(appointmentsData.appointments);
      setSlots(slotsData.slots);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar agenda");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    await api.updateAppointment(id, { status });
    await loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Agenda interna</span>
          </div>
          <h1 className="text-3xl font-display font-bold">Agendamentos</h1>
          <p className="text-muted text-sm">Horarios criados manualmente ou por agentes de IA no WhatsApp.</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2.5 bg-surface border border-border rounded-xl text-xs font-bold hover:bg-bg transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl p-4 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-muted font-bold uppercase tracking-wider mb-2">Proximo compromisso</p>
          {nextAppointment ? (
            <>
              <h2 className="font-bold text-lg">{nextAppointment.title}</h2>
              <p className="text-primary font-bold mt-2">{formatDateTime(nextAppointment.startsAt)}</p>
              <p className="text-xs text-muted mt-1">{statusLabel(nextAppointment.status)}</p>
            </>
          ) : (
            <p className="text-sm text-muted">Nenhum compromisso futuro confirmado.</p>
          )}
        </div>

        <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-5">
          <p className="text-xs text-muted font-bold uppercase tracking-wider mb-3">Proximos horarios livres</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {slots.map((slot) => (
              <div key={slot} className="bg-bg border border-border rounded-xl p-3 text-xs font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {formatDateTime(slot)}
              </div>
            ))}
            {!loading && slots.length === 0 && (
              <p className="text-sm text-muted col-span-full">Sem horarios livres nos proximos dias.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-bold text-lg">Compromissos dos proximos 30 dias</h2>
        </div>
        {loading ? (
          <div className="p-8 text-muted text-sm">Carregando agenda...</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-muted text-sm">Nenhum agendamento encontrado.</div>
        ) : (
          <div className="divide-y divide-border">
            {appointments.map((appointment) => (
              <div key={appointment.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold">{appointment.title}</h3>
                    <span className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase",
                      appointment.status === "cancelled" ? "bg-red-50 text-red-600" : "bg-primary/10 text-primary"
                    )}>
                      {statusLabel(appointment.status)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{formatDateTime(appointment.startsAt)} ate {formatDateTime(appointment.endsAt)}</p>
                  {appointment.source && <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Origem: {appointment.source}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateStatus(appointment.id, "confirmed")}
                    className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Confirmar
                  </button>
                  <button
                    onClick={() => updateStatus(appointment.id, "cancelled")}
                    className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
