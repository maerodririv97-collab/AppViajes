import { useEffect, useState } from "react";
import { useDataStore } from "../store/dataStore";

interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
}

/** Ejecuta `fn` al montar, cuando cambian `deps` y cada vez que se escriben datos. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]): QueryResult<T> {
  const version = useDataStore((s) => s.version);
  const [state, setState] = useState<QueryResult<T>>({ data: undefined, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fn()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((err) => !cancelled && setState({ data: undefined, loading: false, error: String(err) }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return state;
}
