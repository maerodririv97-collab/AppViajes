import { useState } from "react";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Money } from "../../../components/ui/Money";
import { ProgressBar } from "../../../components/ui/ProgressBar";
import { useMutation } from "../../../hooks/useMutation";
import { formatDate } from "../../../lib/format";
import { deleteContribution } from "../../../lib/repo";
import type { Contribution } from "../../../types";
import type { TripData } from "../tripData";
import { ContributionFormModal, type ContributionMode } from "./ContributionFormModal";

export function BudgetTab({ data }: { data: TripData }) {
  const { trip, members, balances, contributions } = data;
  const cur = trip.currency;
  const [form, setForm] = useState<{
    mode: ContributionMode;
    personId?: number;
    contribution?: Contribution;
  } | null>(null);
  const [toDelete, setToDelete] = useState<Contribution | null>(null);
  const del = useMutation();

  if (members.length === 0) {
    return <p className="text-sm text-slate-500">Agrega integrantes al viaje para registrar su presupuesto.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {balances.map((b) => (
          <div key={b.person_id} className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium">{b.name}</span>
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" onClick={() => setForm({ mode: "adjust", personId: b.person_id })}>
                  <SlidersHorizontal size={13} /> Ajustar
                </Button>
                <Button size="sm" onClick={() => setForm({ mode: "add", personId: b.person_id })}>
                  <Plus size={13} /> Aportar
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-slate-500">Puso</div>
                <Money value={b.budget} currency={cur} className="text-sm font-semibold" />
              </div>
              <div>
                <div className="text-slate-500">Gastado</div>
                <Money value={b.spent} currency={cur} className="text-sm font-medium" />
              </div>
              <div>
                <div className="text-slate-500">Le queda</div>
                <Money value={b.budget - b.spent} currency={cur} signed className="text-sm font-semibold" />
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar used={b.spent} total={b.budget} />
            </div>
            <div className="mt-2 text-xs text-slate-500">
              En mano (con préstamos): <Money value={b.available} currency={cur} signed className="font-medium" />
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <span className="font-medium">Historial de aportes y ajustes</span>
          <Button size="sm" onClick={() => setForm({ mode: "add" })}>
            <Plus size={13} /> Nuevo aporte
          </Button>
        </div>
        {contributions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">Aún no hay aportes registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Fecha</th>
                  <th className="th">Persona</th>
                  <th className="th">Nota</th>
                  <th className="th text-right">Valor</th>
                  <th className="th w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contributions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="td whitespace-nowrap text-slate-500">{formatDate(c.date)}</td>
                    <td className="td font-medium">{c.person_name}</td>
                    <td className="td text-slate-500">{c.note ?? "—"}</td>
                    <td className={`td text-right font-medium ${c.amount >= 0 ? "text-teal-700" : ""}`}>
                      {c.amount >= 0 ? "+" : ""}
                      <Money value={c.amount} currency={cur} signed />
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <IconButton title="Editar" onClick={() => setForm({ mode: "edit", contribution: c })}>
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton
                          tone="danger"
                          title="Eliminar"
                          onClick={() => {
                            del.setError(null);
                            setToDelete(c);
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
        )}
      </div>

      <ContributionFormModal
        open={!!form}
        mode={form?.mode ?? "add"}
        data={data}
        personId={form?.personId}
        contribution={form?.contribution}
        onClose={() => setForm(null)}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar movimiento"
        message={`¿Eliminar este movimiento de ${toDelete?.person_name}? Su presupuesto se recalculará.`}
        busy={del.busy}
        error={del.error}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await del.run(() => deleteContribution(toDelete.id)))) setToDelete(null);
        }}
      />
    </div>
  );
}
