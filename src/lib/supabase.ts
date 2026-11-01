import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (ver .env.local).");
}

export const supabase = createClient(url, key);

/**
 * Devuelve `data` o lanza el error de Supabase como Error con su mensaje. Sin error, `data`
 * solo es null en `.maybeSingle()` sin fila; quien la use debe tiparlo como `T | null`.
 */
export function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}
