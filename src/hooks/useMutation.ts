import { useState } from "react";
import { useDataStore } from "../store/dataStore";

/** Envuelve una escritura: maneja estado de carga/error y refresca las consultas al terminar. */
export function useMutation() {
  const bump = useDataStore((s) => s.bump);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await fn();
      bump();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, setError };
}
