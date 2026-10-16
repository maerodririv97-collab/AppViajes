import { useState } from "react";
import { Plus, UserMinus, UserPlus } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button";
import { ConfirmDialog, ErrorBox } from "../../../components/ui/ConfirmDialog";
import { Money } from "../../../components/ui/Money";
import { useMutation } from "../../../hooks/useMutation";
import { useQuery } from "../../../hooks/useQuery";
import { addMember, listPeople, removeMember } from "../../../lib/repo";
import type { Person } from "../../../types";
import { PersonFormModal } from "../../people/PersonFormModal";
import type { TripData } from "../tripData";

export function MembersTab({ data }: { data: TripData }) {
  const { trip, members, balances } = data;
  const { data: people = [] } = useQuery(listPeople, []);
  const [selected, setSelected] = useState("");
  const [personFormOpen, setPersonFormOpen] = useState(false);
  const [toRemove, setToRemove] = useState<Person | null>(null);
  const add = useMutation();
  const remove = useMutation();

  const memberIds = new Set(members.map((m) => m.id));
  const candidates = people.filter((p) => !memberIds.has(p.id));

  async function addSelected() {
    if (!selected) return;
    if (await add.run(() => addMember(trip.id, Number(selected)))) setSelected("");
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <span className="label">Agregar integrante</span>
        <div className="flex gap-2">
          <select className="input max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">
              {candidates.length ? "Selecciona una persona…" : "No hay más personas disponibles"}
            </option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Button onClick={addSelected} disabled={!selected || add.busy}>
            <UserPlus size={15} /> Agregar
          </Button>
          <Button variant="secondary" onClick={() => setPersonFormOpen(true)}>
            <Plus size={15} /> Crear persona nueva
          </Button>
        </div>
        {add.error && <ErrorBox message={add.error} />}
      </div>

      <div className="card overflow-hidden">
        {members.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Este viaje aún no tiene integrantes.</p>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th">Nombre</th>
                <th className="th">Teléfono</th>
                <th className="th text-right">Presupuesto</th>
                <th className="th text-right">Disponible</th>
                <th className="th w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {members.map((m) => {
                const b = balances.find((x) => x.person_id === m.id);
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="td font-medium">{m.name}</td>
                    <td className="td text-slate-500">{m.phone ?? "—"}</td>
                    <td className="td text-right">
                      <Money value={b?.budget ?? 0} currency={trip.currency} />
                    </td>
                    <td className="td text-right">
                      <Money value={b?.available ?? 0} currency={trip.currency} signed />
                    </td>
                    <td className="td text-right">
                      <IconButton
                        title="Quitar del viaje"
                        onClick={() => {
                          remove.setError(null);
                          setToRemove(m);
                        }}
                      >
                        <UserMinus size={15} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <PersonFormModal
        open={personFormOpen}
        onClose={() => setPersonFormOpen(false)}
        onSaved={(id) => add.run(() => addMember(trip.id, id))}
      />
      <ConfirmDialog
        open={!!toRemove}
        title="Quitar integrante"
        message={`¿Quitar a ${toRemove?.name} de "${trip.name}"?`}
        confirmLabel="Quitar"
        busy={remove.busy}
        error={remove.error}
        onClose={() => setToRemove(null)}
        onConfirm={async () => {
          if (toRemove && (await remove.run(() => removeMember(trip.id, toRemove.id)))) setToRemove(null);
        }}
      />
    </div>
  );
}
