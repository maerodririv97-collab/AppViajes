import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { ErrorBox } from "../../../components/ui/ConfirmDialog";
import { Field } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { Money } from "../../../components/ui/Money";
import { useMutation } from "../../../hooks/useMutation";
import { roundMoney, today } from "../../../lib/format";
import { createContribution, updateContribution } from "../../../lib/repo";
import type { Contribution } from "../../../types";
import type { TripData } from "../tripData";

/**
 * - add:    suma un aporte al presupuesto de la persona.
 * - adjust: fija el presupuesto en un total nuevo; se guarda la diferencia como movimiento.
 * - edit:   corrige un movimiento existente del historial.
 */
export type ContributionMode = "add" | "adjust" | "edit";

interface Props {
  open: boolean;
  mode: ContributionMode;
  data: TripData;
  personId?: number | null;
  contribution?: Contribution | null;
  onClose: () => void;
}

export function ContributionFormModal({ open, mode, data, personId, contribution, onClose }: Props) {
  const { trip, members, balances, walletBalances } = data;
  const cur = trip.currency;
  const [person, setPerson] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setError(null);
    const pid = contribution?.person_id ?? personId ?? members[0]?.id ?? 0;
    setPerson(pid);
    setDate(contribution?.date ?? today());
    setNote(contribution?.note ?? "");
    if (mode === "edit") setAmount(String(contribution?.amount ?? ""));
    else if (mode === "adjust") setAmount(String(balances.find((b) => b.person_id === pid)?.budget ?? 0));
    else setAmount("");
  }, [open, mode, contribution, personId, members, balances, setError]);

  const currentBudget = balances.find((b) => b.person_id === person)?.budget ?? 0;
  const value = Number(amount);
  const delta = mode === "adjust" ? roundMoney(value - currentBudget, cur) : value;
  // Los aportes salen de la billetera; al editar, el movimiento original ya está descontado.
  const walletBalance =
    (walletBalances.find((w) => w.person_id === person)?.balance ?? 0) +
    (mode === "edit" && contribution ? contribution.amount : 0);
  const walletShort = !Number.isNaN(delta) && roundMoney(walletBalance - delta, cur) < 0;

  async function save() {
    if (!person) return setError("Selecciona una persona.");
    if (amount.trim() === "" || Number.isNaN(value)) return setError("Escribe un valor válido.");
    if (mode === "add" && value <= 0) return setError("El aporte debe ser mayor que cero.");
    if (mode === "adjust" && value < 0) return setError("El presupuesto no puede ser negativo.");
    if (mode === "edit" && value === 0) return setError("El valor no puede ser cero.");
    if (mode === "adjust" && Math.abs(delta) < 0.005) return onClose();

    const input = {
      person_id: person,
      amount: roundMoney(delta, cur),
      date,
      note: note.trim() || (mode === "adjust" ? "Ajuste de presupuesto" : null),
    };
    const ok = await run(() =>
      mode === "edit" && contribution
        ? updateContribution(contribution.id, input)
        : createContribution(trip.id, input),
    );
    if (ok) onClose();
  }

  const title = { add: "Agregar aporte", adjust: "Ajustar presupuesto", edit: "Editar movimiento" }[mode];
  const amountLabel = {
    add: `Valor del aporte (${cur})`,
    adjust: `Nuevo presupuesto total (${cur})`,
    edit: `Valor (${cur}) — negativo si es una reducción`,
  }[mode];

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
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
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Persona">
          <select
            className="input"
            value={person}
            disabled={mode !== "add"}
            onChange={(e) => {
              const pid = Number(e.target.value);
              setPerson(pid);
              if (mode === "adjust")
                setAmount(String(balances.find((b) => b.person_id === pid)?.budget ?? 0));
            }}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={amountLabel}>
            <input
              type="number"
              step="any"
              min={mode === "edit" ? undefined : "0"}
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Fecha">
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        {mode === "adjust" && (
          <p className="text-sm text-slate-500">
            Presupuesto actual: <Money value={currentBudget} currency={cur} className="font-medium" />
            {Math.abs(delta) >= 0.005 && !Number.isNaN(delta) && (
              <>
                {" · "}se registrará un movimiento de{" "}
                <Money
                  value={delta}
                  currency={cur}
                  className={`font-medium ${delta < 0 ? "text-rose-600" : "text-teal-700"}`}
                />
              </>
            )}
          </p>
        )}
        <p className={`text-sm ${walletShort ? "text-amber-700" : "text-slate-500"}`}>
          Saldo en billetera: <Money value={walletBalance} currency={cur} signed className="font-medium" />
          {walletShort && " — no alcanza; registra primero la plata en la pestaña Billetera o guarda igual."}
        </p>
        <Field label="Nota (opcional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
