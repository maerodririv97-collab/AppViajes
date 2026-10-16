import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { ErrorBox } from "../../../components/ui/ConfirmDialog";
import { Field } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { useMutation } from "../../../hooks/useMutation";
import { today } from "../../../lib/format";
import { daysBetween } from "../../../lib/itinerary";
import { createRouteStop, updateRouteStop } from "../../../lib/repo";
import type { RouteStop } from "../../../types";
import type { TripData } from "../tripData";

interface Props {
  open: boolean;
  data: TripData;
  stop?: RouteStop | null;
  onClose: () => void;
}

export function RouteStopFormModal({ open, data, stop, onClose }: Props) {
  const { trip, route } = data;
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [arrival, setArrival] = useState("");
  const [departure, setDeparture] = useState("");
  const [notes, setNotes] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setError(null);
    // Una ciudad nueva arranca donde termina la anterior y en el mismo país.
    const last = route[route.length - 1];
    setCountry(stop?.country ?? last?.country ?? "");
    setCity(stop?.city ?? "");
    setArrival(stop?.arrival_date ?? last?.departure_date ?? trip.start_date ?? today());
    setDeparture(stop?.departure_date ?? "");
    setNotes(stop?.notes ?? "");
  }, [open, stop, route, trip.start_date, setError]);

  const countries = [...new Set(route.map((s) => s.country))];
  const nights = arrival && departure && departure >= arrival ? daysBetween(arrival, departure) : null;

  async function save() {
    if (!country.trim()) return setError("Escribe el país.");
    if (!city.trim()) return setError("Escribe la ciudad.");
    if (!arrival || !departure) return setError("Indica las fechas de llegada y salida.");
    if (departure < arrival) return setError("La salida no puede ser antes de la llegada.");
    const input = { country, city, arrival_date: arrival, departure_date: departure, notes };
    const ok = await run(() => (stop ? updateRouteStop(stop.id, input) : createRouteStop(trip.id, input)));
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      title={stop ? "Editar ciudad" : "Agregar ciudad a la ruta"}
      onClose={onClose}
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
        <Field label="País">
          <input
            className="input"
            list="route-countries"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Ej: España"
          />
          <datalist id="route-countries">
            {countries.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Ciudad">
          <input
            className="input"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ej: Madrid"
            autoFocus
          />
        </Field>
        <Field label="Llegada">
          <input type="date" className="input" value={arrival} onChange={(e) => setArrival(e.target.value)} />
        </Field>
        <Field label="Salida">
          <input type="date" className="input" value={departure} onChange={(e) => setDeparture(e.target.value)} />
        </Field>
        {nights != null && (
          <p className="col-span-2 -mt-2 text-sm text-slate-500">
            {nights === 0 ? "Visita de un día, sin noches." : `${nights} ${nights === 1 ? "noche" : "noches"} en la ciudad.`}
          </p>
        )}
        <Field label="Notas (opcional)" className="col-span-2">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
