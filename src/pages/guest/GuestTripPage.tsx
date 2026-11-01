import { useParams } from "react-router-dom";
import { CalendarDays, Eye, LogOut, Luggage, MapPin, Map as MapIcon, Route } from "lucide-react";
import { EmptyState } from "../../components/ui/EmptyState";
import { useQuery } from "../../hooks/useQuery";
import { formatDate } from "../../lib/format";
import { buildTimeline, daysBetween, formatDayHeader, kindMeta, statusMeta, timeOf } from "../../lib/itinerary";
import { getGuestTrip } from "../../lib/repo";
import type { GuestTrip } from "../../types";
import { EventDetails } from "../trips/tabs/ItineraryTab";

/** Vista pública de solo lectura (link de invitado): ruta e itinerario, sin dinero ni acciones. */
export function GuestTripPage() {
  const code = useParams().code ?? "";
  const { data, loading, error } = useQuery(() => getGuestTrip(code), [code]);

  return (
    <div className="h-full overflow-y-auto">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <Luggage size={20} className="text-teal-400" />
            <span className="font-semibold">AppViajes</span>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-slate-300">
            <Eye size={14} /> Vista de invitado
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5 md:px-8 md:py-7">
        {loading && !data ? null : error ? (
          <p className="text-sm text-rose-700">No se pudo cargar el viaje: {error}</p>
        ) : !data ? (
          <EmptyState
            icon={Luggage}
            title="Este link no está disponible"
            description="Puede que se haya desactivado o reemplazado por uno nuevo. Pide el link actualizado a quien te lo compartió."
          />
        ) : (
          <GuestTripView data={data} />
        )}
      </main>
    </div>
  );
}

function GuestTripView({ data }: { data: GuestTrip }) {
  const { trip, itinerary, route } = data;
  const days = buildTimeline(itinerary);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{trip.name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          {trip.destination && (
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {trip.destination}
            </span>
          )}
          {(trip.start_date || trip.end_date) && (
            <span className="flex items-center gap-1">
              <CalendarDays size={14} /> {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
            </span>
          )}
        </div>
      </div>

      {route.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <Route size={17} className="text-teal-600" /> Ruta
          </h2>
          <ol className="card divide-y divide-slate-100">
            {route.map((s, i) => {
              const n = daysBetween(s.arrival_date, s.departure_date);
              return (
                <li key={s.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {s.city} <span className="font-normal text-slate-500">· {s.country}</span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {formatDate(s.arrival_date)}
                      {s.departure_date !== s.arrival_date && ` – ${formatDate(s.departure_date)}`}
                      {n > 0 && ` · ${n} ${n === 1 ? "noche" : "noches"}`}
                    </div>
                    {s.notes && <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{s.notes}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
          <MapIcon size={17} className="text-teal-600" /> Vuelos, hospedajes y transportes
        </h2>
        {days.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay nada en el itinerario.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-500">Horas en hora local de cada lugar.</p>
            <div className="space-y-5">
              {days.map((day) => {
                const dayNumber = trip.start_date ? daysBetween(trip.start_date, day.date) + 1 : null;
                return (
                  <section key={day.date}>
                    <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-slate-700">
                      {dayNumber != null && dayNumber >= 1 && (
                        <span className="rounded bg-teal-600 px-1.5 py-0.5 text-xs text-white">Día {dayNumber}</span>
                      )}
                      {formatDayHeader(day.date)}
                    </h3>
                    <ul className="card divide-y divide-slate-100">
                      {day.events.map((ev) => {
                        const { item } = ev;
                        const meta = kindMeta(item.kind);
                        const Icon = ev.type === "checkout" ? LogOut : meta.icon;
                        return (
                          <li key={`${item.id}-${ev.type}`} className="flex items-start gap-3 px-4 py-3">
                            <div className="w-12 pt-0.5 text-sm font-semibold tabular-nums text-slate-700">
                              {timeOf(ev.at)}
                            </div>
                            <div className={`rounded-lg p-1.5 ${meta.color}`}>
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <EventDetails ev={ev} />
                              {ev.type !== "checkout" && item.notes && (
                                <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{item.notes}</p>
                              )}
                            </div>
                            {ev.type !== "checkout" && item.status === "pending" && (
                              <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${statusMeta(item.status).color}`}>
                                {statusMeta(item.status).label}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </section>
    </>
  );
}
