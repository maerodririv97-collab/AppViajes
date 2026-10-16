import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { ErrorBox } from "../../../components/ui/ConfirmDialog";
import { Field } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { useMutation } from "../../../hooks/useMutation";
import { roundMoney, today } from "../../../lib/format";
import { createWalletDeposit, updateWalletDeposit } from "../../../lib/repo";
import type { WalletDeposit } from "../../../types";
import type { TripData } from "../tripData";

interface Props {
  open: boolean;
  data: TripData;
  personId?: number | null;
  deposit?: WalletDeposit | null;
  onClose: () => void;
}

/** Registra plata que entra (o sale, con valor negativo al editar) de la billetera de una persona. */
export function WalletDepositModal({ open, data, personId, deposit, onClose }: Props) {
  const { trip, members } = data;
  const cur = trip.currency;
  const [person, setPerson] = useState(0);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPerson(deposit?.person_id ?? personId ?? members[0]?.id ?? 0);
    setAmount(deposit ? String(deposit.amount) : "");
    setDate(deposit?.date ?? today());
    setNote(deposit?.note ?? "");
  }, [open, deposit, personId, members, setError]);

  async function save() {
    const value = Number(amount);
    if (!person) return setError("Selecciona una persona.");
    if (amount.trim() === "" || Number.isNaN(value) || value === 0) return setError("Escribe un valor válido.");
    const input = { person_id: person, amount: roundMoney(value, cur), date, note };
    const ok = await run(() => (deposit ? updateWalletDeposit(deposit.id, input) : createWalletDeposit(trip.id, input)));
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      title={deposit ? "Editar movimiento de billetera" : "Agregar plata a la billetera"}
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
          <select className="input" value={person} onChange={(e) => setPerson(Number(e.target.value))}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Valor (${cur}) — negativo si sale plata`}>
            <input
              type="number"
              step="any"
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
        <Field label="Nota (opcional)">
          <input
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: ahorros, cambio de divisas…"
          />
        </Field>
        <button type="submit" hidden />
      </form>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
