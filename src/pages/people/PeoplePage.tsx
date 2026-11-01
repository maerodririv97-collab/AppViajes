import { useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { PageHeader } from "../../components/layout/Layout";
import { Button, IconButton } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { useMutation } from "../../hooks/useMutation";
import { useQuery } from "../../hooks/useQuery";
import { deletePerson, listPeople } from "../../lib/repo";
import type { Person } from "../../types";
import { PersonFormModal } from "./PersonFormModal";

export function PeoplePage() {
  const { data: people = [], loading } = useQuery(listPeople, []);
  const [editing, setEditing] = useState<Person | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Person | null>(null);
  const del = useMutation();

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Personas"
        subtitle="Catálogo de viajeros. Asígnalos a cada viaje desde la pestaña Integrantes."
        actions={
          <Button onClick={openNew}>
            <Plus size={16} /> Nueva persona
          </Button>
        }
      />

      {!loading && people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay personas"
          description="Crea a las personas que viajan para poder asignarles presupuesto y gastos."
          action={<Button onClick={openNew}>Crear persona</Button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Nombre</th>
                  <th className="th">Teléfono</th>
                  <th className="th">Notas</th>
                  <th className="th text-right">Viajes</th>
                  <th className="th w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="td font-medium">{p.name}</td>
                    <td className="td text-slate-500">{p.phone ?? "—"}</td>
                    <td className="td text-slate-500">{p.notes ?? "—"}</td>
                    <td className="td text-right tabular-nums">{p.trip_count}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <IconButton
                          title="Editar"
                          onClick={() => {
                            setEditing(p);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton
                          tone="danger"
                          title="Eliminar"
                          onClick={() => {
                            del.setError(null);
                            setToDelete(p);
                          }}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PersonFormModal open={formOpen} person={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar persona"
        message={`¿Eliminar a ${toDelete?.name}? Esta acción no se puede deshacer.`}
        busy={del.busy}
        error={del.error}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await del.run(() => deletePerson(toDelete.id)))) setToDelete(null);
        }}
      />
    </>
  );
}
