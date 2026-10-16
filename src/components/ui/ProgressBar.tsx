/** Barra de consumo del presupuesto: verde < 75 %, ámbar < 100 %, rojo si se pasa. */
export function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : used > 0 ? 100 : 0;
  const color = pct >= 100 ? "bg-rose-500" : pct >= 75 ? "bg-amber-500" : "bg-teal-500";
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}
