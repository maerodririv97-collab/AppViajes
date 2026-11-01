import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ErrorBox } from "../../components/ui/ConfirmDialog";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useMutation } from "../../hooks/useMutation";
import { joinTrip } from "../../lib/repo";

interface Props {
  open: boolean;
  onClose: () => void;
  onJoined: (id: number) => void;
}

export function JoinTripModal({ open, onClose, onJoined }: Props) {
  const [code, setCode] = useState("");
  const { run, busy, error, setError } = useMutation();

  useEffect(() => {
    if (!open) return;
    setCode("");
    setError(null);
  }, [open, setError]);

  async function join() {
    if (!code.trim()) return setError("Escribe el código de invitación.");
    let tripId = 0;
    if (await run(async () => (tripId = await joinTrip(code)))) {
      onClose();
      onJoined(tripId);
    }
  }

  return (
    <Modal
      open={open}
      title="Unirme a un viaje"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={join} disabled={busy}>
            Unirme
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Pídele el código a quien creó el viaje; aparece junto al nombre del viaje.
      </p>
      <Field label="Código de invitación">
        <input
          className="input font-mono"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="ej. 3f9a1c2b"
          autoFocus
        />
      </Field>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
