import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ErrorBox } from "../../../components/ui/ConfirmDialog";
import { Field } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { useMutation } from "../../../hooks/useMutation";
import { ITINERARY_STATUSES, TRANSPORT_MODES, kindMeta } from "../../../lib/itinerary";
import { createItineraryItem, updateItineraryItem } from "../../../lib/repo";
import type { ItineraryItem, ItineraryKind, ItineraryStatus } from "../../../types";
import type { TripData } from "../tripData";

interface Props {
  open: boolean;
  data: TripData;
  kind: ItineraryKind;
  item?: ItineraryItem | null;
  /** Valores iniciales al crear (p. ej. desde un faltante de la ruta). */
  defaults?: Partial<ItineraryItem>;
  onClose: () => void;
}

/** Hora por defecto al crear: check-in 15:00, check-out 12:00, resto 08:00. */
const defaultAt = (date: string | null, time: string) => (date ? `${date}T${time}` : "");

export function ItineraryFormModal({ open, data, kind, item, defaults, onClose }: Props) {
  const { trip } = data;
  const [status, setStatus] = useState<ItineraryStatus>("booked");
  const [provider, setProvider] = useState("");
  const [reference, setReference] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [address, setAddress] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [code, setCode] = useState("");
  const [notes, setNotes] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setError(null);
    const init = item ?? defaults ?? {};
    setStatus(init.status ?? "booked");
    setProvider(init.provider ?? "");
    setReference(init.reference ?? (kind === "transport" ? TRANSPORT_MODES[0] : ""));
    setOrigin(init.origin ?? "");
    setDestination(init.destination ?? "");
    setAddress(init.address ?? "");
    setStartAt(init.start_at ?? defaultAt(trip.start_date, kind === "lodging" ? "15:00" : "08:00"));
    setEndAt(init.end_at ?? (kind === "lodging" ? defaultAt(trip.end_date, "12:00") : ""));
    setCode(init.confirmation_code ?? "");
    setNotes(init.notes ?? "");
  }, [open, item, defaults, kind, trip.start_date, trip.end_date, setError]);

  const meta = kindMeta(kind);
  const isLodging = kind === "lodging";
  const endBeforeStart = !!startAt && !!endAt && endAt <= startAt;

  async function save() {
    if (!startAt) return setError(isLodging ? "Indica la fecha y hora de check-in." : "Indica la fecha y hora de salida.");
    if (kind === "flight") {
      if (!origin.trim() || !destination.trim()) return setError("Indica el origen y el destino del vuelo.");
      if (!endAt) return setError("Indica la fecha y hora de llegada.");
    }
    if (isLodging) {
      if (!provider.trim()) return setError("Escribe el nombre del alojamiento.");
      if (!endAt) return setError("Indica la fecha y hora de check-out.");
      if (endBeforeStart) return setError("El check-out debe ser posterior al check-in.");
    }
    if (kind === "transport" && (!origin.trim() || !destination.trim())) {
      return setError("Indica desde dónde y hacia dónde es el trayecto.");
    }
    const input = {
      kind,
      status,
      provider,
      reference,
      origin: isLodging ? null : origin,
      destination: isLodging ? null : destination,
      address: isLodging ? address : null,
      start_at: startAt,
      end_at: endAt,
      confirmation_code: code,
      notes,
    };
    const ok = await run(() => (item ? updateItineraryItem(item.id, input) : createItineraryItem(trip.id, input)));
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      title={`${item ? "Editar" : "Nuevo"} ${meta.label.toLowerCase()}`}
      onClose={onClose}
      width="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {kind === "flight" && (
          <>
            <Field label="Aerolínea">
              <input
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Ej: Avianca"
                autoFocus
              />
            </Field>
            <Field label="Número de vuelo">
              <input
                className="input"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ej: AV 010"
              />
            </Field>
          </>
        )}

        {isLodging && (
          <>
            <Field label="Alojamiento" className="col-span-2">
              <input
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Ej: Hotel Caribe / Airbnb Getsemaní"
                autoFocus
              />
            </Field>
            <Field label="Dirección" className="col-span-2">
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
          </>
        )}

        {kind === "transport" && (
          <>
            <Field label="Medio">
              <select className="input" value={reference} onChange={(e) => setReference(e.target.value)}>
                {TRANSPORT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                {reference && !TRANSPORT_MODES.includes(reference) && <option value={reference}>{reference}</option>}
              </select>
            </Field>
            <Field label="Empresa (opcional)">
              <input
                className="input"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="Ej: Expreso Brasilia"
              />
            </Field>
          </>
        )}

        {!isLodging && (
          <>
            <Field label="Origen">
              <input
                className="input"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder={kind === "flight" ? "Ej: Bogotá (BOG)" : "Ej: Aeropuerto"}
              />
            </Field>
            <Field label="Destino">
              <input
                className="input"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder={kind === "flight" ? "Ej: Madrid (MAD)" : "Ej: Hotel"}
              />
            </Field>
          </>
        )}

        <Field label={isLodging ? "Check-in" : "Salida (hora local)"}>
          <input
            type="datetime-local"
            className="input"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </Field>
        <Field label={isLodging ? "Check-out" : kind === "flight" ? "Llegada (hora local)" : "Llegada (opcional)"}>
          <input type="datetime-local" className="input" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </Field>

        {isLodging && (
          <Field label="Habitación (opcional)">
            <input
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: Doble, 2 camas"
            />
          </Field>
        )}
        <Field label={kind === "transport" ? "Código / tiquete" : "Código de reserva"}>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="Estado">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as ItineraryStatus)}>
            {ITINERARY_STATUSES.map((s) => (
              <option key={s.status} value={s.status}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notas (opcional)" className="col-span-2">
          <textarea
            className="input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              kind === "flight"
                ? "Terminal, equipaje, asientos…"
                : isLodging
                  ? "Contacto, wifi, cómo llegar…"
                  : "Punto de encuentro, contacto…"
            }
          />
        </Field>
      </div>

      {!isLodging && endBeforeStart && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            La llegada queda antes de la salida. Puede ser correcto si cambias de zona horaria (las horas son locales);
            si no, revísalas.
          </span>
        </div>
      )}
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
