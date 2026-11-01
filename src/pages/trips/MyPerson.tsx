import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { ErrorBox } from "../../components/ui/ConfirmDialog";
import { Modal } from "../../components/ui/Modal";
import { useMutation } from "../../hooks/useMutation";
import { setMyPerson } from "../../lib/repo";
import type { TripData } from "./tripData";

/** Integrantes que la cuenta actual puede elegir: los no vinculados a otra cuenta. */
function choices(data: TripData) {
  return data.members.filter((m) => !data.claimedPersonIds.includes(m.id));
}

function PersonSelect({
  data,
  value,
  onChange,
}: {
  data: TripData;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Elige quién eres…</option>
      {choices(data).map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

/** Aviso sobre las pestañas mientras la cuenta no se haya vinculado a un participante. */
export function MyPersonBanner({ data }: { data: TripData }) {
  const [value, setValue] = useState("");
  const { run, busy, error } = useMutation();

  if (choices(data).length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <UserRound size={18} className="text-teal-700" />
        <span className="text-sm text-teal-900">
          <strong>¿Quién eres en este viaje?</strong> Así te mostramos tu disponible y tus deudas.
        </span>
        <div className="flex flex-1 gap-2 sm:max-w-sm">
          <PersonSelect data={data} value={value} onChange={setValue} />
          <Button disabled={!value || busy} onClick={() => run(() => setMyPerson(data.trip.id, Number(value)))}>
            Guardar
          </Button>
        </div>
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}

export function MyPersonModal({ open, data, onClose }: { open: boolean; data: TripData; onClose: () => void }) {
  const [value, setValue] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setValue(data.myPersonId ? String(data.myPersonId) : "");
    setError(null);
  }, [open, data.myPersonId, setError]);

  async function save(personId: number | null) {
    if (await run(() => setMyPerson(data.trip.id, personId))) onClose();
  }

  return (
    <Modal
      open={open}
      title="¿Quién eres en este viaje?"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => save(null)} disabled={busy} className="mr-auto">
            Desvincular
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save(Number(value))} disabled={!value || busy}>
            Guardar
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Solo aparecen los integrantes que no están vinculados a otra cuenta.
      </p>
      <PersonSelect data={data} value={value} onChange={setValue} />
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
