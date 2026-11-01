import { useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Luggage, Plane, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";

const links = [
  { to: "/", label: "Viajes", icon: Plane, end: true },
  { to: "/personas", label: "Personas", icon: Users, end: false },
];

export function Layout() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Escritorio: menú lateral */}
      <aside className="hidden w-56 shrink-0 flex-col bg-slate-900 text-slate-300 md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-white">
          <Luggage size={22} className="text-teal-400" />
          <span className="text-lg font-semibold">AppViajes</span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-teal-600 text-white" : "hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-800 px-3 py-3">
          {email && <div className="truncate px-3 pb-2 text-xs text-slate-400">{email}</div>}
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-slate-800 hover:text-white"
          >
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Móvil: cabecera arriba y navegación abajo */}
      <header className="flex shrink-0 items-center justify-between bg-slate-900 px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2">
          <Luggage size={20} className="text-teal-400" />
          <span className="font-semibold">AppViajes</span>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          title={email ?? undefined}
        >
          <LogOut size={15} /> Salir
        </button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-7">
          <Outlet />
        </div>
      </main>

      <nav className="flex shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                isActive ? "text-teal-700" : "text-slate-500"
              }`
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
