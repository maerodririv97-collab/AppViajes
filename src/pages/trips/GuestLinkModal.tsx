import { useState } from "react";
import { Check, Copy, Eye, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ErrorBox } from "../../components/ui/ConfirmDialog";
import { Modal } from "../../components/ui/Modal";
import { useMutation } from "../../hooks/useMutation";
import { guestUrl, setGuestCode } from "../../lib/repo";
import type { Trip } from "../../types";

/** Activa, copia, regenera o desactiva el link de invitado (solo lectura de itinerario y ruta). */
export function GuestLinkModal({ open, trip, onClose }: { open: boolean; trip: Trip; onClose: () => void }) {
  const { run, busy, error } = useMutation();
  const [copied, setCopied] = useState(false);
  const url = trip.guest_code ? guestUrl(trip.guest_code) : null;

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal open={open} title="Compartir con invitados" onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Con este link cualquiera puede ver la <strong>ruta y el itinerario</strong> del viaje sin crear cuenta. No
          ve presupuesto, gastos, deudas, notas del viaje ni códigos de reserva, y no puede cambiar nada.
        </p>

        {url ? (
          <>
            <div className="flex gap-2">
              <input className="input font-mono text-xs sm:text-xs" value={url} readOnly onFocus={(e) => e.target.select()} />
              <Button onClick={copy} className="shrink-0">
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => window.open(url, "_blank", "noopener")}>
                <Eye size={14} /> Ver como invitado
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => run(() => setGuestCode(trip.id, true))}
                title="El link anterior deja de funcionar"
              >
                <RefreshCw size={14} /> Generar link nuevo
              </Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setGuestCode(trip.id, false))}>
                Desactivar link
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Si el link llegó a quien no debía, genera uno nuevo: el anterior deja de funcionar.
            </p>
          </>
        ) : (
          <Button disabled={busy} onClick={() => run(() => setGuestCode(trip.id, true))}>
            Crear link de invitado
          </Button>
        )}
        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}
