import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ErrorBox } from "../../../components/ui/ConfirmDialog";
import { Field } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Money } from "../../../components/ui/Money";
import { useMutation } from "../../../hooks/useMutation";
import { CATEGORIES } from "../../../lib/categories";
import { roundMoney, today } from "../../../lib/format";
import { createExpense, expenseEffect, updateExpense } from "../../../lib/repo";
import { splitEqual } from "../../../lib/split";
import type { ExpenseWithShares } from "../../../types";
import type { TripData } from "../tripData";

type SplitMode = "equal" | "custom";

interface Props {
  open: boolean;
  data: TripData;
  expense?: ExpenseWithShares | null;
  onClose: () => void;
}

export function ExpenseFormModal({ open, data, expense, onClose }: Props) {
  const { trip, members, balances } = data;
  const cur = trip.currency;
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [participants, setParticipants] = useState<number[]>([]);
  const [mode, setMode] = useState<SplitMode>("equal");
  const [custom, setCustom] = useState<Record<number, string>>({});
  /** "" = fondo común; si no, id de quien pagó. */
  const [paidBy, setPaidBy] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (expense) {
      setCategory(expense.category);
      setDescription(expense.description);
      setAmount(String(expense.amount));
      setDate(expense.date);
      setNotes(expense.notes ?? "");
      setParticipants(expense.shares.map((s) => s.person_id));
      const [equal] = splitEqual(expense.amount, expense.shares.length);
      const isEqual = expense.shares.every((s) => Math.abs(s.amount - equal) < 1e-6);
      setMode(isEqual ? "equal" : "custom");
      setCustom(
        Object.fromEntries(expense.shares.map((s) => [s.person_id, String(roundMoney(s.amount, cur))])),
      );
      setPaidBy(expense.paid_by_person_id == null ? "" : String(expense.paid_by_person_id));
    } else {
      setCategory(CATEGORIES[0].name);
      setDescription("");
      setAmount("");
      setDate(today());
      setNotes("");
      setParticipants(members.map((m) => m.id));
      setMode("equal");
      setCustom({});
      setPaidBy("");
    }
  }, [open, expense, members, cur, setError]);

  const total = Number(amount) || 0;
  const selected = members.filter((m) => participants.includes(m.id));

  const shares = (() => {
    if (mode === "equal") {
      const parts = splitEqual(total, selected.length);
      return selected.map((m, i) => ({ person_id: m.id, amount: parts[i] }));
    }
    return selected.map((m) => ({ person_id: m.id, amount: roundMoney(Number(custom[m.id]) || 0, cur) }));
  })();

  const assigned = shares.reduce((s, x) => s + x.amount, 0);
  const diff = roundMoney(total - assigned, cur);

  const payerId = paidBy ? Number(paidBy) : null;
  const payerName = members.find((m) => m.id === payerId)?.name;

  // Disponible "antes" de este gasto: si se está editando, se revierte el efecto que ya tenía.
  const availableBefore = (personId: number) => {
    const b = balances.find((x) => x.person_id === personId);
    const prev = expense ? expenseEffect(expense.shares, expense.paid_by_person_id, personId) : 0;
    return (b?.available ?? 0) - prev;
  };
  const availableAfter = (personId: number) =>
    availableBefore(personId) + expenseEffect(shares, payerId, personId);
  const affected = (personId: number) => participants.includes(personId) || personId === payerId;
  const overBudget = members.filter((m) => affected(m.id) && availableAfter(m.id) < -0.004);

  const toggle = (id: number) =>
    setParticipants((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function save() {
    if (!description.trim()) return setError("Escribe una descripción del gasto.");
    if (total <= 0) return setError("El valor total debe ser mayor que cero.");
    if (shares.length === 0) return setError("Selecciona al menos una persona para dividir el gasto.");
    if (Math.abs(diff) > 0.004) return setError("La suma de las partes debe ser igual al valor total.");
    const input = {
      category,
      description,
      amount: roundMoney(total, cur),
      date,
      notes,
      paid_by_person_id: payerId,
      shares,
    };
    const ok = await run(() => (expense ? updateExpense(expense.id, input) : createExpense(trip.id, input)));
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      title={expense ? "Editar gasto" : "Nuevo gasto"}
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
      <div className="space-y-4">
        <div>
          <span className="label">Categoría</span>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(({ name, icon: Icon }) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                  category === name
                    ? "border-teal-600 bg-teal-600 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-teal-500"
                }`}
              >
                <Icon size={14} /> {name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Descripción" className="col-span-2">
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Vuelos Bogotá – Cartagena"
              autoFocus
            />
          </Field>
          <Field label={`Valor total (${cur})`}>
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Fecha">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="División">
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as SplitMode)}>
              <option value="equal">Partes iguales</option>
              <option value="custom">Montos personalizados</option>
            </select>
          </Field>
          <Field label="Pagado por">
            <select className="input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              <option value="">Fondo común (cada uno paga su parte)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <span className="label">Se divide entre</span>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th w-8" />
                  <th className="th">Persona</th>
                  <th className="th text-right">Disponible</th>
                  <th className="th text-right">Su parte</th>
                  <th className="th text-right">Queda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const included = participants.includes(m.id);
                  const share = shares.find((s) => s.person_id === m.id)?.amount ?? 0;
                  const before = availableBefore(m.id);
                  return (
                    <tr key={m.id} className={affected(m.id) ? "" : "text-slate-400"}>
                      <td className="td">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => toggle(m.id)}
                          className="accent-teal-600"
                        />
                      </td>
                      <td className="td">
                        {m.name}
                        {m.id === payerId && (
                          <span className="ml-2 rounded bg-teal-100 px-1.5 py-0.5 text-xs text-teal-700">
                            pagó
                          </span>
                        )}
                      </td>
                      <td className="td text-right">
                        <Money value={before} currency={cur} signed />
                      </td>
                      <td className="td text-right">
                        {included && mode === "custom" ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            className="input ml-auto w-32 py-1 text-right"
                            value={custom[m.id] ?? ""}
                            onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                          />
                        ) : (
                          <Money value={included ? share : 0} currency={cur} />
                        )}
                      </td>
                      <td className="td text-right font-medium">
                        {affected(m.id) ? (
                          <Money value={availableAfter(m.id)} currency={cur} signed />
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {mode === "custom" && Math.abs(diff) > 0.004 && (
            <p className="mt-2 text-sm text-amber-700">
              {diff > 0 ? "Faltan por asignar " : "Sobran "}
              <Money value={Math.abs(diff)} currency={cur} className="font-semibold" />.
            </p>
          )}
          {payerName && shares.some((x) => x.person_id !== payerId) && (
            <p className="mt-2 text-sm text-slate-600">
              {payerName} pone el valor total con su dinero; cada participante queda debiéndole su parte (se ve
              en Préstamos → Deudas pendientes).
            </p>
          )}
          {overBudget.length > 0 && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                {overBudget.map((m) => m.name).join(", ")}{" "}
                {overBudget.length === 1 ? "queda" : "quedan"} con saldo negativo. Puedes guardar igual y
                cubrirlo con un aporte o un préstamo.
              </span>
            </div>
          )}
        </div>

        <Field label="Notas (opcional)">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
