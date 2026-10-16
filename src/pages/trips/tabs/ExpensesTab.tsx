import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Money } from "../../../components/ui/Money";
import { useMutation } from "../../../hooks/useMutation";
import { CATEGORIES, categoryMeta } from "../../../lib/categories";
import { formatDate } from "../../../lib/format";
import { deleteExpense } from "../../../lib/repo";
import type { ExpenseWithShares } from "../../../types";
import type { TripData } from "../tripData";
import { ExpenseFormModal } from "./ExpenseFormModal";

export function ExpensesTab({ data }: { data: TripData }) {
  const { trip, members, expenses, transfers } = data;
  const cur = trip.currency;
  const [filter, setFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithShares | null>(null);
  const [toDelete, setToDelete] = useState<ExpenseWithShares | null>(null);
  const del = useMutation();

  const visible = filter ? expenses.filter((e) => e.category === filter) : expenses;
  const visibleTotal = visible.reduce((s, e) => s + e.amount, 0);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  if (members.length === 0) {
    return <p className="text-sm text-slate-500">Agrega integrantes al viaje antes de registrar gastos.</p>;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <select className="input w-56" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <Button onClick={openNew}>
          <Plus size={16} /> Nuevo gasto
        </Button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Sin gastos registrados"
          description="Registra vuelos, hospedaje, comidas… El valor se divide entre las personas y se descuenta de su presupuesto."
          action={<Button onClick={openNew}>Registrar gasto</Button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="th w-8" />
                <th className="th">Fecha</th>
                <th className="th">Categoría</th>
                <th className="th">Descripción</th>
                <th className="th">Pagó</th>
                <th className="th text-right">Personas</th>
                <th className="th text-right">Total</th>
                <th className="th w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((e) => {
                const meta = categoryMeta(e.category);
                const Icon = meta.icon;
                const isOpen = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpanded(isOpen ? null : e.id)}
                    >
                      <td className="td text-slate-400">
                        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </td>
                      <td className="td whitespace-nowrap text-slate-500">{formatDate(e.date)}</td>
                      <td className="td">
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${meta.color}`}>
                          <Icon size={12} /> {e.category}
                        </span>
                      </td>
                      <td className="td">{e.description}</td>
                      <td className="td text-slate-500">{e.paid_by_name ?? "Fondo común"}</td>
                      <td className="td text-right tabular-nums">{e.shares.length}</td>
                      <td className="td text-right font-medium">
                        <Money value={e.amount} currency={cur} />
                      </td>
                      <td className="td" onClick={(ev) => ev.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <IconButton
                            title="Editar"
                            onClick={() => {
                              setEditing(e);
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
                              setToDelete(e);
                            }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50/60">
                        <td />
                        <td colSpan={7} className="px-4 pb-3 pt-1">
                          <div className="flex flex-wrap gap-2">
                            {e.shares.map((s) => {
                              const cover = transfers.find(
                                (t) => t.kind === "loan" && t.expense_id === e.id && t.to_person_id === s.person_id,
                              );
                              return (
                                <span
                                  key={s.person_id}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                                >
                                  {s.person_name}: <Money value={s.amount} currency={cur} className="font-medium" />
                                  {cover && <span className="ml-1 text-sky-700">(se lo prestó {cover.from_name})</span>}
                                </span>
                              );
                            })}
                          </div>
                          {e.notes && <p className="mt-2 text-xs text-slate-500">{e.notes}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={6} className="td text-right font-medium text-slate-500">
                  Total{filter ? ` ${filter}` : ""}
                </td>
                <td className="td text-right font-semibold">
                  <Money value={visibleTotal} currency={cur} />
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <ExpenseFormModal open={formOpen} data={data} expense={editing} onClose={() => setFormOpen(false)} />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar gasto"
        message={`¿Eliminar "${toDelete?.description}"? Su valor se devolverá al disponible de cada persona.`}
        busy={del.busy}
        error={del.error}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await del.run(() => deleteExpense(toDelete.id)))) setToDelete(null);
        }}
      />
    </>
  );
}
