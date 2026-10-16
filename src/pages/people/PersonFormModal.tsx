import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorBox } from "../../components/ui/ConfirmDialog";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useMutation } from "../../hooks/useMutation";
import { createPerson, updatePerson } from "../../lib/repo";
import type { Person } from "../../types";

interface Props {
  open: boolean;
  person?: Person | null;
  onClose: () => void;
  onSaved?: (id: number) => void;
}

export function PersonFormModal({ open, person, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setName(person?.name ?? "");
    setPhone(person?.phone ?? "");
    setNotes(person?.notes ?? "");
    setError(null);
  }, [open, person, setError]);

  async function save() {
    if (!name.trim()) return setError("El nombre es obligatorio.");
    let id = person?.id ?? 0;
    const ok = await run(async () => {
      if (person) await updatePerson(person.id, { name, phone, notes });
      else id = await createPerson({ name, phone, notes });
    });
    if (ok) {
      onSaved?.(id);
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      title={person ? "Editar persona" : "Nueva persona"}
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
        <Field label="Nombre">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Teléfono (opcional)">
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Notas (opcional)">
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <button type="submit" hidden />
      </form>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
