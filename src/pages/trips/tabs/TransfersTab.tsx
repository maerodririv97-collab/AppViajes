import { useState } from "react";
import { ArrowRight, HandCoins, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { Money } from "../../../components/ui/Money";
import { useMutation } from "../../../hooks/useMutation";
import { formatDate } from "../../../lib/format";
import { deleteTransfer } from "../../../lib/repo";
import type { Transfer } from "../../../types";
import type { TripData } from "../tripData";
import { TransferFormModal, type TransferPreset } from "./TransferFormModal";

export function TransfersTab({ data }: { data: TripData }) {
  const { trip, members, transfers, debts } = data;
  const cur = trip.currency;
  const [form, setForm] = useState<{ transfer?: Transfer; preset?: TransferPreset } | null>(null);
  const [toDelete, setToDelete] = useState<Transfer | null>(null);
  const del = useMutation();

  if (members.length < 2) {
    return <p className="text-sm text-slate-500">Se necesitan al menos dos integrantes para registrar préstamos.</p>;
  }

  const newLoan = () => setForm({ preset: { kind: "loan" } });

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setForm({ preset: { kind: "repayment" } })}>
          <Undo2 size={15} /> Registrar devolución
        </Button>
        <Button onClick={newLoan}>
          <Plus size={16} /> Cubrir parte de un gasto
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 font-medium">
          Deudas por gastos
          <span className="ml-2 text-xs font-normal text-slate-500">
            gastos pagados por otro y partes cubiertas con préstamo
          </span>
        </div>
        {debts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No hay deudas pendientes entre integrantes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {debts.map((d) => (
              <li key={`${d.debtor_id}-${d.creditor_id}`} className="flex items-center justify-between px-4 py-3">
                <span className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{d.debtor_name}</span>
                  <span className="text-slate-400">le debe a</span>
                  <span className="font-medium">{d.creditor_name}</span>
                </span>
                <div className="flex items-center gap-4">
                  <Money value={d.amount} currency={cur} className="font-semibold text-amber-700" />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setForm({
                        preset: { kind: "repayment", from: d.debtor_id, to: d.creditor_id, amount: d.amount },
                      })
                    }
                  >
                    <Undo2 size={13} /> Saldar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {transfers.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="Sin préstamos de gastos"
          description="Cuando alguien cubra la parte de otra persona en un gasto, regístralo aquí: se descuenta del presupuesto de quien presta y queda como deuda. Los préstamos de plata suelta van en la pestaña Billetera."
          action={<Button onClick={newLoan}>Registrar préstamo</Button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 font-medium">Movimientos</div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Fecha</th>
                <th className="th">Tipo</th>
                <th className="th">Movimiento</th>
                <th className="th">Cubre / nota</th>
                <th className="th text-right">Valor</th>
                <th className="th w-24 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transfers.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap text-slate-500">{formatDate(t.date)}</td>
                  <td className="td">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        t.kind === "loan" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {t.kind === "loan" ? "Préstamo" : "Devolución"}
                    </span>
                  </td>
                  <td className="td">
                    <span className="flex items-center gap-2">
                      {t.from_name} <ArrowRight size={14} className="text-slate-400" /> {t.to_name}
                    </span>
                  </td>
                  <td className="td text-slate-500">
                    {t.expense_description && (
                      <span className="mr-2 rounded bg-sky-50 px-1.5 py-0.5 text-xs text-sky-700">
                        Su parte de: {t.expense_description}
                      </span>
                    )}
                    {t.note ?? (t.expense_description ? "" : "—")}
                  </td>
                  <td className="td text-right font-medium">
                    <Money value={t.amount} currency={cur} />
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1">
                      <IconButton title="Editar" onClick={() => setForm({ transfer: t })}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        tone="danger"
                        title="Eliminar"
                        onClick={() => {
                          del.setError(null);
                          setToDelete(t);
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

      <TransferFormModal
        open={!!form}
        scope="budget"
        data={data}
        transfer={form?.transfer}
        preset={form?.preset}
        onClose={() => setForm(null)}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar movimiento"
        message="¿Eliminar este movimiento? Los disponibles y las deudas se recalcularán."
        busy={del.busy}
        error={del.error}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await del.run(() => deleteTransfer(toDelete.id)))) setToDelete(null);
        }}
      />
    </div>
  );
}
