import { useState } from "react";
import { AlertTriangle, ArrowRight, Info, LogOut, Map as MapIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, IconButton } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useMutation } from "../../../hooks/useMutation";
import {
  ITINERARY_KINDS,
  buildTimeline,
  dayOf,
  daysBetween,
  formatDayHeader,
  itemTitle,
  itineraryAlerts,
  kindMeta,
  statusMeta,
  timeOf,
  type TimelineEvent,
} from "../../../lib/itinerary";
import { formatDate } from "../../../lib/format";
import { deleteItineraryItem } from "../../../lib/repo";
import type { ItineraryItem, ItineraryKind } from "../../../types";
import type { TripData } from "../tripData";
import { ItineraryFormModal } from "./ItineraryFormModal";
import { RouteSection } from "./RouteSection";

/** "+1", "+2"… cuando la llegada cae en otro día que la salida. */
export function DayShift({ from, to }: { from: string; to: string }) {
  const n = daysBetween(dayOf(from), dayOf(to));
  if (n === 0) return null;
  return (
    <sup className="ml-0.5 text-[10px] font-semibold text-rose-600" title={formatDate(dayOf(to))}>
      {n > 0 ? `+${n}` : n}
    </sup>
  );
}

export function EventDetails({ ev }: { ev: TimelineEvent }) {
  const { item } = ev;
  if (ev.type === "checkout") {
    return <div className="text-sm text-slate-500">Check-out · {itemTitle(item)}</div>;
  }
  if (item.kind === "lodging") {
    const nights = item.end_at ? daysBetween(dayOf(item.start_at), dayOf(item.end_at)) : null;
    return (
      <>
        <div className="font-medium">{itemTitle(item)}</div>
        <div className="text-sm text-slate-500">
          Check-in
          {nights != null && ` · ${nights} ${nights === 1 ? "noche" : "noches"} hasta el ${formatDate(dayOf(item.end_at!))} ${timeOf(item.end_at!)}`}
          {item.reference && ` · ${item.reference}`}
        </div>
        {item.address && <div className="text-sm text-slate-500">{item.address}</div>}
      </>
    );
  }
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 font-medium">
        <span>{item.origin}</span>
        <ArrowRight size={14} className="text-slate-400" />
        <span>{item.destination}</span>
      </div>
      <div className="text-sm text-slate-500">
        {itemTitle(item)}
        {item.end_at && (
          <>
            {" · llega "}
            {timeOf(item.end_at)}
            <DayShift from={item.start_at} to={item.end_at} />
          </>
        )}
      </div>
    </>
  );
}

export function ItineraryTab({ data }: { data: TripData }) {
  const { trip, itinerary, route } = data;
  const [form, setForm] = useState<{
    kind: ItineraryKind;
    item: ItineraryItem | null;
    defaults?: Partial<ItineraryItem>;
  } | null>(null);
  const [toDelete, setToDelete] = useState<ItineraryItem | null>(null);
  const del = useMutation();

  const days = buildTimeline(itinerary);
  const alerts = itineraryAlerts(trip, itinerary, route);

  const addButtons = (
    <div className="flex flex-wrap gap-2">
      {ITINERARY_KINDS.map(({ kind, label, icon: Icon }) => (
        <Button key={kind} variant={kind === "flight" ? "primary" : "secondary"} onClick={() => setForm({ kind, item: null })}>
          <Plus size={15} /> <Icon size={15} /> {label}
        </Button>
      ))}
    </div>
  );

  return (
    <>
      <RouteSection data={data} onAdd={(kind, defaults) => setForm({ kind, item: null, defaults })} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-slate-800">
            <MapIcon size={17} className="text-teal-600" /> Vuelos, hospedajes y transportes
          </h3>
          <p className="text-sm text-slate-500">Horas en hora local de cada lugar, como aparecen en las reservas.</p>
        </div>
        {itinerary.length > 0 && addButtons}
      </div>

      {itinerary.length === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="Itinerario vacío"
          description="Registra los vuelos, hospedajes y transportes del viaje con sus fechas y códigos de reserva."
          action={addButtons}
        />
      ) : (
        <>
          {alerts.length > 0 && (
            <div className="mb-4 space-y-2">
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                    a.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-sky-200 bg-sky-50 text-sky-800"
                  }`}
                >
                  {a.tone === "warning" ? (
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  ) : (
                    <Info size={16} className="mt-0.5 shrink-0" />
                  )}
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          )}

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
                      const status = statusMeta(item.status);
                      const cancelled = item.status === "cancelled";
                      return (
                        <li
                          key={`${item.id}-${ev.type}`}
                          className={`flex items-start gap-3 px-4 py-3 ${cancelled ? "opacity-50" : ""}`}
                        >
                          <div className="w-12 pt-0.5 text-sm font-semibold tabular-nums text-slate-700">
                            {timeOf(ev.at)}
                          </div>
                          <div className={`rounded-lg p-1.5 ${meta.color}`}>
                            <Icon size={16} />
                          </div>
                          <div className={`min-w-0 flex-1 ${cancelled ? "line-through" : ""}`}>
                            <EventDetails ev={ev} />
                            {ev.type !== "checkout" && item.notes && (
                              <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{item.notes}</p>
                            )}
                          </div>
                          {ev.type !== "checkout" && (
                            <div className="flex shrink-0 flex-col items-end gap-1 text-xs">
                              <span className={`rounded px-2 py-0.5 ${status.color}`}>{status.label}</span>
                              {item.confirmation_code && (
                                <span className="font-mono text-slate-600" title="Código de reserva">
                                  {item.confirmation_code}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex shrink-0 gap-1">
                            <IconButton title="Editar" onClick={() => setForm({ kind: item.kind, item })}>
                              <Pencil size={15} />
                            </IconButton>
                            <IconButton
                              tone="danger"
                              title="Eliminar"
                              onClick={() => {
                                del.setError(null);
                                setToDelete(item);
                              }}
                            >
                              <Trash2 size={15} />
                            </IconButton>
                          </div>
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

      <ItineraryFormModal
        open={!!form}
        data={data}
        kind={form?.kind ?? "flight"}
        item={form?.item}
        defaults={form?.defaults}
        onClose={() => setForm(null)}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar del itinerario"
        message={`¿Eliminar "${toDelete ? itemTitle(toDelete) : ""}" del itinerario?`}
        busy={del.busy}
        error={del.error}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete && (await del.run(() => deleteItineraryItem(toDelete.id)))) setToDelete(null);
        }}
      />
    </>
  );
}
