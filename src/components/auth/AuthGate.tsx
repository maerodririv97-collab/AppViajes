import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Luggage } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Button } from "../ui/Button";
import { ErrorBox } from "../ui/ConfirmDialog";
import { Field } from "../ui/Field";

/** Muestra el login hasta que haya sesión; las políticas RLS dependen del usuario autenticado. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  return session ? <>{children}</> : <LoginPage />;
}

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setError(error.message);
    // Con confirmación de correo activa, signUp no abre sesión hasta confirmar.
    if (mode === "signup" && !data.session) {
      setNotice("Te enviamos un correo para confirmar la cuenta. Ábrelo y luego inicia sesión.");
      setMode("signin");
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-2 text-slate-900">
          <Luggage size={22} className="text-teal-600" />
          <span className="text-lg font-semibold">AppViajes</span>
        </div>
        <p className="text-sm text-slate-500">
          {mode === "signin" ? "Inicia sesión para ver tus viajes." : "Crea tu cuenta para compartir viajes."}
        </p>
        <Field label="Correo">
          <input
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Contraseña">
          <input
            className="input"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error && <ErrorBox message={error} />}
        {notice && <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">{notice}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {mode === "signin" ? "Entrar" : "Crear cuenta"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="w-full text-center text-sm text-teal-700 hover:underline"
        >
          {mode === "signin" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </form>
    </div>
  );
}
