import { useState } from "react";
import { ArrowRight, HandCoins, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Money } from "../../../components/ui/Money";
import { useMutation } from "../../../hooks/useMutation";
import { formatDate, roundMoney } from "../../../lib/format";
import { deleteTransfer, deleteWalletDeposit } from "../../../lib/repo";
import type { Transfer, WalletDeposit } from "../../../types";
import type { TripData } from "../tripData";
import { TransferFormModal, type TransferPreset } from "./TransferFormModal";
import { WalletDepositModal } from "./WalletDepositModal";
import { Editable } from "../../../components/ui/ReadOnly";

type Pending =
  | { type: "deposit"; item: WalletDeposit }
  | { type: "transfer"; item: Transfer };

export function WalletTab({ data }: { data: TripData }) {
  const { trip, members, walletBalances, walletTransfers, walletDebts, deposits } = data;
  const cur = trip.currency;
  const [depositForm, setDepositForm] = useState<{ personId?: number; deposit?: WalletDeposit } | null>(null);
  const [transferForm, setTransferForm] = useState<{ transfer?: Transfer; preset?: TransferPreset } | null>(null);
  const [toDelete, setToDelete] = useState<Pending | null>(null);
  const del = useMutation();

  if (members.length === 0) {
    return <p className="text-sm text-slate-500">Agrega integrantes al viaje para usar la billetera.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
        <p className="max-w-xl text-sm text-slate-500">
          La billetera es la plata de cada persona, aparte del presupuesto. De aquí salen los aportes al
          presupuesto y los préstamos de plata suelta entre ustedes; esos préstamos no cambian lo que a cada uno le
          queda en el presupuesto.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setDepositForm({})}>
            <Plus size={15} /> Agregar plata
          </Button>
          {members.length > 1 && (
            <>
              <Button variant="secondary" onClick={() => setTransferForm({ preset: { kind: "repayment" } })}>
                <Undo2 size={15} /> Devolución
              </Button>
              <Button onClick={() => setTransferForm({ preset: { kind: "loan" } })}>
                <HandCoins size={15} /> Prestar plata
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 font-medium">Billetera por persona</div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="th">Persona</th>
                <th className="th text-right">Ingresó</th>
                <th className="th text-right">Pasó al presupuesto</th>
                <th className="th text-right" title="Préstamos y devoluciones que entregó">
                  Prestó / devolvió
                </th>
                <th className="th text-right" title="Préstamos y devoluciones que recibió">
                  Recibió
                </th>
                <th className="th text-right">Saldo</th>
                <th className="th text-right">Debe / le deben</th>
                <th className="th w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {walletBalances.map((w) => {
                const debt = roundMoney(w.net_debt, cur);
                return (
                  <tr key={w.person_id}>
                    <td className="td font-medium">{w.name}</td>
                    <td className="td text-right">
                      <Money value={w.deposits} currency={cur} />
                    </td>
                    <td className="td text-right">
                      <Money value={w.contributed} currency={cur} />
                    </td>
                    <td className="td text-right text-slate-500">
                      <Money value={w.given} currency={cur} />
                    </td>
                    <td className="td text-right text-slate-500">
                      <Money value={w.received} currency={cur} />
                    </td>
                    <td className="td text-right font-semibold">
                      <Money value={w.balance} currency={cur} signed />
                    </td>
                    <td className="td text-right text-xs">
                      {debt > 0 && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                          debe <Money value={debt} currency={cur} />
                        </span>
                      )}
                      {debt < 0 && (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700">
                          le deben <Money value={-debt} currency={cur} />
                        </span>
                      )}
                      {debt === 0 && <span className="text-slate-400">—</span>}
                    </td>
                    <td className="td text-right">
                      <IconButton title="Agregar plata" onClick={() => setDepositForm({ personId: w.person_id })}>
                        <Plus size={15} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <strong>Saldo</strong> = ingresó − pasó al presupuesto − prestó/devolvió + recibió. Un saldo negativo
          indica que falta registrar plata que entró a su billetera.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 font-medium">Deudas de billetera</div>
        {walletDebts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No hay préstamos de plata pendientes.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {walletDebts.map((d) => (
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
                      setTransferForm({
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

      <div className="space-y-6">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 font-medium">Ingresos a billetera</div>
          {deposits.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              Registra cuánta plata tiene cada persona para el viaje.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Fecha</th>
                    <th className="th">Persona</th>
                    <th className="th text-right">Valor</th>
                    <th className="th w-24 text-right">
                    <Editable>Acciones</Editable>
                  </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deposits.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="td whitespace-nowrap text-slate-500">{formatDate(d.date)}</td>
                      <td className="td">
                        <div className="font-medium">{d.person_name}</div>
                        {d.note && <div className="text-xs text-slate-500">{d.note}</div>}
                      </td>
                      <td className="td text-right font-medium">
                        <Money value={d.amount} currency={cur} signed />
                      </td>
                      <td className="td w-20">
                        <div className="flex justify-end gap-1">
                          <IconButton title="Editar" onClick={() => setDepositForm({ deposit: d })}>
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton
                            tone="danger"
                            title="Eliminar"
                            onClick={() => {
                              del.setError(null);
                              setToDelete({ type: "deposit", item: d });
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

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 font-medium">Préstamos y devoluciones</div>
          {walletTransfers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">Sin préstamos de plata entre billeteras.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Fecha</th>
                    <th className="th">Movimiento</th>
                    <th className="th text-right">Valor</th>
                    <th className="th w-24 text-right">
                    <Editable>Acciones</Editable>
                  </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {walletTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="td whitespace-nowrap text-slate-500">{formatDate(t.date)}</td>
                      <td className="td">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs ${
                              t.kind === "loan" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {t.kind === "loan" ? "Préstamo" : "Devolución"}
                          </span>
                          {t.from_name} <ArrowRight size={13} className="text-slate-400" /> {t.to_name}
                        </div>
                        {t.note && <div className="mt-0.5 text-xs text-slate-500">{t.note}</div>}
                      </td>
                      <td className="td text-right font-medium">
                        <Money value={t.amount} currency={cur} />
                      </td>
                      <td className="td w-20">
                        <div className="flex justify-end gap-1">
                          <IconButton title="Editar" onClick={() => setTransferForm({ transfer: t })}>
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton
                            tone="danger"
                            title="Eliminar"
                            onClick={() => {
                              del.setError(null);
                              setToDelete({ type: "transfer", item: t });
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
      </div>

      <WalletDepositModal
        open={!!depositForm}
        data={data}
        personId={depositForm?.personId}
        deposit={depositForm?.deposit}
        onClose={() => setDepositForm(null)}
      />
      <TransferFormModal
        open={!!transferForm}
        scope="wallet"
        data={data}
        transfer={transferForm?.transfer}
        preset={transferForm?.preset}
        onClose={() => setTransferForm(null)}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar movimiento"
        message="¿Eliminar este movimiento de billetera? Los saldos y deudas se recalcularán."
        busy={del.busy}
        error={del.error}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          const ok = await del.run(() =>
            toDelete.type === "deposit" ? deleteWalletDeposit(toDelete.item.id) : deleteTransfer(toDelete.item.id),
          );
          if (ok) setToDelete(null);
        }}
      />
    </div>
  );
}
