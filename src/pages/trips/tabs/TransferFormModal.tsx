import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ErrorBox } from "../../../components/ui/ConfirmDialog";
import { Field } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Money } from "../../../components/ui/Money";
import { useMutation } from "../../../hooks/useMutation";
import { formatDate, roundMoney, today } from "../../../lib/format";
import { createTransfer, deleteTransfer, updateTransfer } from "../../../lib/repo";
import type { Transfer, TransferKind, TransferScope } from "../../../types";
import type { TripData } from "../tripData";

export interface TransferPreset {
  kind: TransferKind;
  from?: number;
  to?: number;
  amount?: number;
}

interface Props {
  open: boolean;
  /**
   * budget: préstamos que cubren partes de gastos y devoluciones de esas deudas.
   * wallet: préstamos de monto libre y devoluciones entre billeteras.
   */
  scope: TransferScope;
  data: TripData;
  transfer?: Transfer | null;
  preset?: TransferPreset | null;
  onClose: () => void;
}

interface CoverableExpense {
  id: number;
  description: string;
  date: string;
  share: number;
  /** Motivo por el que no se puede cubrir; null si está disponible. */
  blockedBy: string | null;
}

export function TransferFormModal({ open, scope, data, transfer, preset, onClose }: Props) {
  const { trip, members, balances, walletBalances, expenses, transfers } = data;
  const cur = trip.currency;
  const [kind, setKind] = useState<TransferKind>("loan");
  const isWallet = scope === "wallet";
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [amount, setAmount] = useState("");
  const [selectedExpenses, setSelectedExpenses] = useState<number[]>([]);
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const { run, busy, error, setError } = useMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    const k = transfer?.kind ?? preset?.kind ?? "loan";
    setKind(k);
    setFrom(transfer?.from_person_id ?? preset?.from ?? members[0]?.id ?? 0);
    setTo(transfer?.to_person_id ?? preset?.to ?? members[1]?.id ?? 0);
    setAmount(
      transfer ? String(roundMoney(transfer.amount, cur)) : preset?.amount ? String(roundMoney(preset.amount, cur)) : "",
    );
    setSelectedExpenses(transfer?.expense_id ? [transfer.expense_id] : []);
    setDate(transfer?.date ?? today());
    setNote(transfer?.note ?? "");
  }, [open, transfer, preset, members, cur, setError]);

  // En gastos un préstamo siempre cubre partes de gastos; en la billetera (y las devoluciones) va por valor.
  const byExpense = !isWallet && kind === "loan";

  // Gastos en los que participa quien recibe el préstamo, con su parte y si ya está cubierta.
  const coverable: CoverableExpense[] = expenses.flatMap((e) => {
    const share = e.shares.find((s) => s.person_id === to);
    if (!share) return [];
    let blockedBy: string | null = null;
    if (e.paid_by_person_id === to) blockedBy = "lo pagó completo";
    else if (e.paid_by_person_id != null) blockedBy = `ya lo pagó ${e.paid_by_name}`;
    else {
      const cover = transfers.find(
        (t) => t.kind === "loan" && t.expense_id === e.id && t.to_person_id === to && t.id !== transfer?.id,
      );
      if (cover) blockedBy = `ya cubierto por ${cover.from_name}`;
    }
    return [{ id: e.id, description: e.description, date: e.date, share: share.amount, blockedBy }];
  });

  const value = byExpense
    ? coverable.filter((c) => selectedExpenses.includes(c.id)).reduce((sum, c) => sum + c.share, 0)
    : Number(amount) || 0;

  // Si se edita, el disponible actual ya tiene descontado este movimiento: se devuelve para previsualizar.
  const fromAvailable =
    (isWallet
      ? walletBalances.find((b) => b.person_id === from)?.balance ?? 0
      : balances.find((b) => b.person_id === from)?.available ?? 0) +
    (transfer && transfer.from_person_id === from ? transfer.amount : 0);
  const insufficient = value > 0 && roundMoney(fromAvailable - value, cur) < 0;

  function toggleExpense(id: number) {
    // Al editar, un movimiento corresponde a un solo gasto.
    if (transfer) return setSelectedExpenses([id]);
    setSelectedExpenses((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function save() {
    if (!from || !to) return setError("Selecciona ambas personas.");
    if (from === to) return setError("Quien entrega y quien recibe deben ser personas distintas.");
    const base = { from_person_id: from, to_person_id: to, kind, scope, date, note };

    if (byExpense) {
      const chosen = coverable.filter((c) => selectedExpenses.includes(c.id) && !c.blockedBy);
      if (chosen.length === 0) return setError("Selecciona al menos un gasto a cubrir.");
      // Se guarda la parte exacta (con decimales) para que cuadre con lo que se le descontó.
      const ok = await run(async () => {
        if (transfer) {
          const [c] = chosen;
          await updateTransfer(transfer.id, { ...base, amount: c.share, expense_id: c.id });
        } else {
          for (const c of chosen) await createTransfer(trip.id, { ...base, amount: c.share, expense_id: c.id });
        }
      });
      if (ok) onClose();
      return;
    }

    if (value <= 0) return setError("El valor debe ser mayor que cero.");
    const input = { ...base, amount: roundMoney(value, cur), expense_id: null };
    const ok = await run(() => (transfer ? updateTransfer(transfer.id, input) : createTransfer(trip.id, input)));
    if (ok) onClose();
  }

  async function remove() {
    if (transfer && (await run(() => deleteTransfer(transfer.id)))) onClose();
  }

  const isLoan = kind === "loan";
  const toName = members.find((m) => m.id === to)?.name ?? "";

  return (
    <Modal
      open={open}
      title={
        (transfer ? "Editar movimiento" : isLoan ? "Registrar préstamo" : "Registrar devolución") +
        (isWallet ? " · billetera" : " · gastos")
      }
      onClose={onClose}
      width="lg"
      footer={
        <>
          {transfer &&
            (confirmDelete ? (
              <div className="mr-auto flex items-center gap-2 text-sm">
                <span className="text-rose-700">¿Eliminar este {isLoan ? "préstamo" : "movimiento"}?</span>
                <Button size="sm" variant="danger" disabled={busy} onClick={remove}>
                  Sí, eliminar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </div>
            ) : (
              <Button variant="ghost" className="mr-auto text-rose-600 hover:bg-rose-50" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={15} /> Eliminar
              </Button>
            ))}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={busy}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
          {(["loan", "repayment"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-md py-1.5 text-sm font-medium transition-colors ${
                kind === k ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
              }`}
            >
              {k === "loan" ? "Préstamo" : "Devolución"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={isLoan ? "Presta" : "Devuelve"}>
            <select className="input" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={isLoan ? "A (a quién le cubre)" : "A"}>
            <select
              className="input"
              value={to}
              onChange={(e) => {
                setTo(Number(e.target.value));
                setSelectedExpenses([]);
              }}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {byExpense ? (
          <div>
            <span className="label">Gastos de {toName} que cubre</span>
            {coverable.length === 0 ? (
              <p className="text-sm text-slate-500">{toName} no participa en ningún gasto todavía.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="th w-8" />
                        <th className="th">Gasto</th>
                        <th className="th">Fecha</th>
                        <th className="th text-right">Parte de {toName}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {coverable.map((c) => (
                        <tr key={c.id} className={c.blockedBy ? "text-slate-400" : ""}>
                          <td className="td">
                            <input
                              type={transfer ? "radio" : "checkbox"}
                              className="accent-teal-600"
                              disabled={!!c.blockedBy}
                              checked={selectedExpenses.includes(c.id)}
                              onChange={() => toggleExpense(c.id)}
                            />
                          </td>
                          <td className="td">
                            {c.description}
                            {c.blockedBy && <span className="ml-2 text-xs italic">({c.blockedBy})</span>}
                          </td>
                          <td className="td whitespace-nowrap">{formatDate(c.date)}</td>
                          <td className="td text-right">
                            <Money value={c.share} currency={cur} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Field label={`Valor (${cur})`}>
            <input
              type="number"
              min="0"
              step="any"
              className="input max-w-xs"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Nota (opcional)">
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Total del movimiento: <Money value={value} currency={cur} className="font-semibold text-slate-800" />
          {" · "}
          {isWallet ? "saldo en billetera de quien entrega: " : "disponible en el presupuesto de quien entrega: "}
          <Money value={fromAvailable} currency={cur} signed className="font-medium" />
        </div>
        {insufficient && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            El valor supera {isWallet ? "el saldo de la billetera" : "el disponible"} de quien entrega; quedará
            en negativo.
          </div>
        )}
      </div>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
