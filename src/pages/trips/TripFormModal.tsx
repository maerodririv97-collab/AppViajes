import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorBox } from "../../components/ui/ConfirmDialog";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useMutation } from "../../hooks/useMutation";
import { useQuery } from "../../hooks/useQuery";
import { CURRENCIES } from "../../lib/format";
import { createTrip, listPeople, updateTrip } from "../../lib/repo";
import type { Trip } from "../../types";

interface Props {
  open: boolean;
  trip?: Trip | null;
  onClose: () => void;
  onCreated?: (id: number) => void;
}

export function TripFormModal({ open, trip, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState("COP");
  const [notes, setNotes] = useState("");
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const { data: people = [] } = useQuery(listPeople, []);
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setName(trip?.name ?? "");
    setDestination(trip?.destination ?? "");
    setStartDate(trip?.start_date ?? "");
    setEndDate(trip?.end_date ?? "");
    setCurrency(trip?.currency ?? "COP");
    setNotes(trip?.notes ?? "");
    setMemberIds([]);
    setError(null);
  }, [open, trip, setError]);

  const toggle = (id: number) =>
    setMemberIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function save() {
    if (!name.trim()) return setError("El nombre del viaje es obligatorio.");
    if (startDate && endDate && endDate < startDate)
      return setError("La fecha de regreso no puede ser anterior a la de salida.");
    const input = { name, destination, start_date: startDate, end_date: endDate, currency, notes };
    let newId = 0;
    const ok = await run(async () => {
      if (trip) await updateTrip(trip.id, input);
      else newId = await createTrip(input, memberIds);
    });
    if (ok) {
      onClose();
      if (!trip) onCreated?.(newId);
    }
  }

  return (
    <Modal
      open={open}
      title={trip ? "Editar viaje" : "Nuevo viaje"}
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
        <Field label="Nombre del viaje" className="col-span-2">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cartagena 2026"
            autoFocus
          />
        </Field>
        <Field label="Destino">
          <input className="input" value={destination} onChange={(e) => setDestination(e.target.value)} />
        </Field>
        <Field label="Moneda">
          <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Salida">
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Regreso">
          <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
        <Field label="Notas" className="col-span-2">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {!trip && (
          <div className="col-span-2">
            <span className="label">Integrantes</span>
            {people.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay personas creadas. Puedes agregarlas después desde la pestaña Integrantes.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {people.map((p) => {
                  const selected = memberIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                        selected
                          ? "border-teal-600 bg-teal-600 text-white"
                          : "border-slate-300 bg-white text-slate-600 hover:border-teal-500"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
