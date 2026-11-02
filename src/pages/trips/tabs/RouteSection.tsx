import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, Pencil, Plus, Route, Trash2, XCircle } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useMutation } from "../../../hooks/useMutation";
import { formatDate } from "../../../lib/format";
import { addDays, analyzeRoute, itemTitle, type StopAnalysis } from "../../../lib/itinerary";
import { deleteRouteStop, setTripDates } from "../../../lib/repo";
import type { ItineraryItem, ItineraryKind, RouteStop } from "../../../types";
import type { TripData } from "../tripData";
import { RouteStopFormModal } from "./RouteStopFormModal";
import { Editable } from "../../../components/ui/ReadOnly";

/** Abre el formulario del itinerario con datos ya rellenados. */
export type AddItineraryFn = (kind: ItineraryKind, defaults: Partial<ItineraryItem>) => void;

const shortDate = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
};

function Ok({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-emerald-700">
      <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function Missing({ children, tone = "danger" }: { children: ReactNode; tone?: "danger" | "warning" }) {
  const color = tone === "danger" ? "text-rose-700" : "text-amber-700";
  const Icon = tone === "danger" ? XCircle : AlertTriangle;
  return (
    <div className={`flex items-start gap-1.5 ${color}`}>
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

const AddLink = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <Editable>
    <button type="button" onClick={onClick} className="text-xs font-medium text-teal-700 hover:underline">
      {children}
    </button>
  </Editable>
);

function TravelCell({
  items,
  missingText,
  from,
  to,
  date,
  onAdd,
}: {
  items: ItineraryItem[];
  missingText: string;
  from: string;
  to: string;
  date: string;
  onAdd: AddItineraryFn;
}) {
  if (items.length > 0) {
    return (
      <Ok>
        {items.map((i) => (
          <div key={i.id}>
            {itemTitle(i)}
            {i.status === "pending" && <span className="ml-1 text-xs text-amber-700">(por reservar)</span>}
          </div>
        ))}
      </Ok>
    );
  }
  const defaults = { origin: from, destination: to, start_at: `${date}T08:00` };
  return (
    <Missing>
      {missingText}
      <div className="flex gap-3">
        <AddLink onClick={() => onAdd("flight", defaults)}>+ Vuelo</AddLink>
        <AddLink onClick={() => onAdd("transport", defaults)}>+ Transporte</AddLink>
      </div>
    </Missing>
  );
}

function LodgingCell({ a, onAdd }: { a: StopAnalysis; onAdd: AddItineraryFn }) {
  if (a.nights.length === 0) return <span className="text-slate-400">—</span>;
  const pending = a.lodgings.some((l) => l.status === "pending");
  if (a.missingNights.length === 0) {
    return (
      <Ok>
        {a.lodgings.map((l) => (
          <div key={l.id}>{itemTitle(l)}</div>
        ))}
        {pending && <div className="text-xs text-amber-700">Hay hospedajes por reservar</div>}
      </Ok>
    );
  }
  // Sugerencia: el primer bloque seguido de noches faltantes.
  const first = a.missingNights[0];
  let last = first;
  while (a.missingNights.includes(addDays(last, 1))) last = addDays(last, 1);
  const all = a.missingNights.length === a.nights.length;
  return (
    <Missing tone={all ? "danger" : "warning"}>
      {all
        ? `Sin hospedaje (${a.nights.length} ${a.nights.length === 1 ? "noche" : "noches"})`
        : `Faltan ${a.missingNights.length} de ${a.nights.length} noches: ${a.missingNights.map(shortDate).join(", ")}`}
      <div>
        <AddLink
          onClick={() =>
            onAdd("lodging", {
              address: `${a.stop.city}, ${a.stop.country}`,
              start_at: `${first}T15:00`,
              end_at: `${addDays(last, 1)}T12:00`,
            })
          }
        >
          + Hospedaje
        </AddLink>
      </div>
    </Missing>
  );
}

export function RouteSection({ data, onAdd }: { data: TripData; onAdd: AddItineraryFn }) {
  const { trip, route, itinerary } = data;
  const [form, setForm] = useState<{ stop: RouteStop | null } | null>(null);
  const [toDelete, setToDelete] = useState<RouteStop | null>(null);
  const del = useMutation();
  const adjust = useMutation();

  const analysis = analyzeRoute(trip, route, itinerary);
  const { stops, startDate, endDate } = analysis;
  const datesDiffer = !!startDate && !!endDate && (trip.start_date !== startDate || trip.end_date !== endDate);
  const first = stops[0];

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-slate-800">
            <Route size={17} className="text-teal-600" /> Ruta
          </h3>
          {route.length > 0 && (
            <p className="text-sm text-slate-500">
              {analysis.countries.length} {analysis.countries.length === 1 ? "país" : "países"} (
              {analysis.countries.join(", ")}) · {route.length} {route.length === 1 ? "ciudad" : "ciudades"} ·{" "}
              {analysis.totalNights} noches
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={() => setForm({ stop: null })}>
          <Plus size={15} /> Ciudad
        </Button>
      </div>

      {route.length === 0 ? (
        <div className="card px-4 py-6 text-center text-sm text-slate-500">
          Agrega las ciudades del viaje con sus fechas de llegada y salida para revisar qué hospedajes y transportes
          faltan.
        </div>
      ) : (
        <>
          {(datesDiffer || analysis.alerts.length > 0) && (
            <div className="mb-3 space-y-2">
              {datesDiffer && (
                <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  <Info size={16} className="shrink-0" />
                  <span className="flex-1">
                    Las fechas del viaje ({formatDate(trip.start_date)} – {formatDate(trip.end_date)}) no coinciden con
                    la ruta ({formatDate(startDate)} – {formatDate(endDate)}).
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={adjust.busy}
                    onClick={() => adjust.run(() => setTripDates(trip.id, startDate!, endDate!))}
                  >
                    Usar fechas de la ruta
                  </Button>
                </div>
              )}
              {analysis.alerts.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                >
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th w-8">#</th>
                    <th className="th">Ciudad</th>
                    <th className="th">Llegada</th>
                    <th className="th">Salida</th>
                    <th className="th text-right">Noches</th>
                    <th className="th">Hospedaje</th>
                    <th className="th">Traslado de salida</th>
                    <th className="th w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 align-top">
                  {first && (
                    <tr className="bg-slate-50/60">
                      <td className="td" />
                      <td className="td text-slate-500" colSpan={5}>
                        Llegada a {first.stop.city}
                      </td>
                      <td className="td">
                        <TravelCell
                          items={analysis.arrival}
                          missingText="Falta cómo llegar"
                          from=""
                          to={first.stop.city}
                          date={first.stop.arrival_date}
                          onAdd={onAdd}
                        />
                      </td>
                      <td />
                    </tr>
                  )}
                  {stops.map((a, i) => (
                    <tr key={a.stop.id}>
                      <td className="td tabular-nums text-slate-400">{i + 1}</td>
                      <td className="td">
                        <div className="font-medium">{a.stop.city}</div>
                        <div className="text-xs text-slate-500">{a.stop.country}</div>
                        {a.stop.notes && <div className="mt-1 text-xs text-slate-400">{a.stop.notes}</div>}
                      </td>
                      <td className="td whitespace-nowrap">{formatDate(a.stop.arrival_date)}</td>
                      <td className="td whitespace-nowrap">{formatDate(a.stop.departure_date)}</td>
                      <td className="td text-right tabular-nums">{a.nights.length}</td>
                      <td className="td">
                        <LodgingCell a={a} onAdd={onAdd} />
                      </td>
                      <td className="td">
                        <TravelCell
                          items={a.departure}
                          missingText={a.next ? `Falta traslado a ${a.next.city}` : "Falta el regreso"}
                          from={a.stop.city}
                          to={a.next?.city ?? ""}
                          date={a.stop.departure_date}
                          onAdd={onAdd}
                        />
                      </td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          <IconButton title="Editar" onClick={() => setForm({ stop: a.stop })}>
                            <Pencil size={15} />
                          </IconButton>
                          <IconButton
                            tone="danger"
                            title="Eliminar"
                            onClick={() => {
                              del.setError(null);
                              setToDelete(a.stop);
                            }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <RouteStopFormModal open={!!form} data={data} stop={form?.stop} onClose={() => setForm(null)} />
      <ConfirmDialog
        open={!!toDelete}
        title="Quitar ciudad"
        message={`¿Quitar ${toDelete?.city} de la ruta? Los vuelos, hospedajes y transportes no se borran.`}
        busy={del.busy}
        error={del.error}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await del.run(() => deleteRouteStop(toDelete.id)))) setToDelete(null);
        }}
      />
    </section>
  );
}
