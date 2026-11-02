import { useState, type ReactNode } from "react";
import { Check, Copy, Eye, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ErrorBox } from "../../components/ui/ConfirmDialog";
import { Modal } from "../../components/ui/Modal";
import { useMutation } from "../../hooks/useMutation";
import { guestUrl, setGuestCode, setViewerCode } from "../../lib/repo";
import type { TripDetail } from "../../types";

function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        className={`input ${mono ? "font-mono" : ""} text-xs sm:text-xs`}
        value={value}
        readOnly
        onFocus={(e) => e.target.select()}
      />
      <Button
        className="shrink-0"
        onClick={async () => {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-medium text-slate-800">{title}</h3>
        <p className="text-slate-600">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Accesos para compartir el viaje: código de visitante (con cuenta, ve todo sin editar) y
 * link de invitado (sin cuenta, solo itinerario y ruta). El código de compañero va en la cabecera.
 */
export function ShareModal({ open, trip, onClose }: { open: boolean; trip: TripDetail; onClose: () => void }) {
  const { run, busy, error } = useMutation();

  return (
    <Modal open={open} title="Compartir el viaje" onClose={onClose}>
      <div className="space-y-6 text-sm">
        {trip.invite_code && (
          <Section
            title="Compañeros"
            description="Se unen con este código desde «Unirme con código» y pueden ver y editar todo."
          >
            <CopyField value={trip.invite_code} />
          </Section>
        )}

        <Section
          title="Visitantes"
          description={
            <>
              Crean su cuenta, se unen con este código y <strong>ven todo el viaje</strong> (gastos y presupuesto
              incluidos), pero <strong>no pueden modificar nada</strong>.
            </>
          }
        >
          {trip.viewer_code ? (
            <>
              <CopyField value={trip.viewer_code} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => run(() => setViewerCode(trip.id, true))}
                  title="El código anterior deja de servir para unirse; quienes ya entraron siguen dentro"
                >
                  <RefreshCw size={14} /> Generar código nuevo
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => setViewerCode(trip.id, false))}>
                  Desactivar
                </Button>
              </div>
            </>
          ) : (
            <Button disabled={busy} onClick={() => run(() => setViewerCode(trip.id, true))}>
              Crear código de visitante
            </Button>
          )}
        </Section>

        <Section
          title="Invitados con link"
          description={
            <>
              Sin crear cuenta, ven solo la <strong>ruta y el itinerario</strong>. Sin dinero, notas ni códigos de
              reserva.
            </>
          }
        >
          {trip.guest_code ? (
            <>
              <CopyField value={guestUrl(trip.guest_code)} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(guestUrl(trip.guest_code!), "_blank", "noopener")}
                >
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
                  Desactivar
                </Button>
              </div>
            </>
          ) : (
            <Button disabled={busy} onClick={() => run(() => setGuestCode(trip.id, true))}>
              Crear link de invitado
            </Button>
          )}
        </Section>

        {error && <ErrorBox message={error} />}
      </div>
    </Modal>
  );
}
