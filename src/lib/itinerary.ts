// Lógica del itinerario que no toca la base: metadatos por tipo, línea de tiempo y alertas.
import { BedDouble, Bus, Plane, type LucideIcon } from "lucide-react";
import { formatDate } from "./format";
import type { ItineraryItem, ItineraryKind, ItineraryStatus, RouteStop, Trip } from "../types";

export const ITINERARY_KINDS: { kind: ItineraryKind; label: string; icon: LucideIcon; color: string }[] = [
  { kind: "flight", label: "Vuelo", icon: Plane, color: "bg-sky-100 text-sky-700" },
  { kind: "lodging", label: "Hospedaje", icon: BedDouble, color: "bg-violet-100 text-violet-700" },
  { kind: "transport", label: "Transporte", icon: Bus, color: "bg-amber-100 text-amber-700" },
];

export function kindMeta(kind: ItineraryKind) {
  return ITINERARY_KINDS.find((k) => k.kind === kind)!;
}

export const ITINERARY_STATUSES: { status: ItineraryStatus; label: string; color: string }[] = [
  { status: "booked", label: "Reservado", color: "bg-emerald-100 text-emerald-700" },
  { status: "pending", label: "Por reservar", color: "bg-amber-100 text-amber-700" },
  { status: "cancelled", label: "Cancelado", color: "bg-slate-200 text-slate-600" },
];

export function statusMeta(status: ItineraryStatus) {
  return ITINERARY_STATUSES.find((s) => s.status === status)!;
}

export const TRANSPORT_MODES = ["Bus", "Tren", "Taxi / app", "Carro alquilado", "Traslado privado", "Ferry", "Metro", "Otro"];

// ─── Fechas ('YYYY-MM-DD' y 'YYYY-MM-DDTHH:MM', siempre hora local del lugar) ──

export const dayOf = (at: string) => at.slice(0, 10);
export const timeOf = (at: string) => at.slice(11, 16);

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Días entre dos fechas 'YYYY-MM-DD' (b - a). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function formatDayHeader(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Título corto de un ítem para listas y mensajes. */
export function itemTitle(item: ItineraryItem): string {
  switch (item.kind) {
    case "flight":
      return [item.provider, item.reference].filter(Boolean).join(" ") || "Vuelo";
    case "lodging":
      return item.provider || "Hospedaje";
    case "transport":
      return [item.reference, item.provider].filter(Boolean).join(" · ") || "Transporte";
  }
}

// ─── Línea de tiempo ───────────────────────────────────────────────────────

/** Un hospedaje genera dos eventos (check-in y check-out); vuelos y transportes, uno. */
export type TimelineEventType = "flight" | "transport" | "checkin" | "checkout";

export interface TimelineEvent {
  item: ItineraryItem;
  type: TimelineEventType;
  at: string;
}

export interface TimelineDay {
  date: string;
  events: TimelineEvent[];
}

export function buildTimeline(items: ItineraryItem[]): TimelineDay[] {
  const events: TimelineEvent[] = [];
  for (const item of items) {
    if (item.kind === "lodging") {
      events.push({ item, type: "checkin", at: item.start_at });
      if (item.end_at) events.push({ item, type: "checkout", at: item.end_at });
    } else {
      events.push({ item, type: item.kind, at: item.start_at });
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at) || a.item.id - b.item.id);

  const days: TimelineDay[] = [];
  for (const ev of events) {
    const date = dayOf(ev.at);
    const last = days[days.length - 1];
    if (last?.date === date) last.events.push(ev);
    else days.push({ date, events: [ev] });
  }
  return days;
}

// ─── Alertas ───────────────────────────────────────────────────────────────

export interface ItineraryAlert {
  tone: "warning" | "info";
  message: string;
}

function rangeText(first: string, last: string): string {
  return first === last ? `la noche del ${formatDate(first)}` : `las noches del ${formatDate(first)} al ${formatDate(last)}`;
}

const activeLodgings = (items: ItineraryItem[]) =>
  items.filter((i) => i.status !== "cancelled" && i.kind === "lodging" && i.end_at);

/** La noche de una fecha d va de d a d+1: el hospedaje la cubre si check-in <= d < check-out. */
const coversNight = (lodging: ItineraryItem, night: string) =>
  dayOf(lodging.start_at) <= night && night < dayOf(lodging.end_at!);

/**
 * Revisa huecos y cruces del itinerario. Los ítems cancelados no cuentan. Si hay ruta, las
 * noches sin hospedaje se revisan por ciudad en `analyzeRoute` y aquí se omiten.
 */
export function itineraryAlerts(trip: Trip, items: ItineraryItem[], route: RouteStop[] = []): ItineraryAlert[] {
  const alerts: ItineraryAlert[] = [];
  const active = items.filter((i) => i.status !== "cancelled");
  const lodgings = activeLodgings(items);

  // Noches del viaje sin hospedaje.
  if (route.length === 0 && trip.start_date && trip.end_date && trip.start_date < trip.end_date) {
    const covered = (night: string) => lodgings.some((l) => coversNight(l, night));
    let gapStart: string | null = null;
    for (let night = trip.start_date; night <= trip.end_date; night = addDays(night, 1)) {
      const isGap = night < trip.end_date && !covered(night);
      if (isGap && !gapStart) gapStart = night;
      if (!isGap && gapStart) {
        alerts.push({
          tone: "warning",
          message: `Sin hospedaje para ${rangeText(gapStart, addDays(night, -1))}. Si es una noche de vuelo o bus, ignora este aviso.`,
        });
        gapStart = null;
      }
    }
  }

  // Hospedajes que se cruzan.
  for (let i = 0; i < lodgings.length; i++) {
    for (let j = i + 1; j < lodgings.length; j++) {
      const a = lodgings[i];
      const b = lodgings[j];
      if (a.start_at < b.end_at! && b.start_at < a.end_at!) {
        alerts.push({ tone: "warning", message: `Los hospedajes "${itemTitle(a)}" y "${itemTitle(b)}" se cruzan.` });
      }
    }
  }

  // Ítems fuera de las fechas del viaje.
  const outside = active.filter(
    (i) =>
      (trip.start_date && dayOf(i.start_at) < trip.start_date) ||
      (trip.end_date && dayOf(i.start_at) > trip.end_date),
  );
  if (outside.length > 0) {
    alerts.push({
      tone: "warning",
      message: `Fuera de las fechas del viaje: ${outside.map(itemTitle).join(", ")}.`,
    });
  }

  const pending = active.filter((i) => i.status === "pending");
  if (pending.length > 0) {
    alerts.push({
      tone: "info",
      message: `Por reservar (${pending.length}): ${pending.map(itemTitle).join(", ")}.`,
    });
  }

  return alerts;
}

// ─── Ruta ──────────────────────────────────────────────────────────────────

export interface StopAnalysis {
  stop: RouteStop;
  /** Siguiente ciudad; null si es la última (su salida es el regreso). */
  next: RouteStop | null;
  /** Fechas de las noches que se pasan en la ciudad (llegada .. salida - 1). */
  nights: string[];
  missingNights: string[];
  /** Hospedajes que cubren alguna de sus noches. */
  lodgings: ItineraryItem[];
  /** Vuelos o transportes hacia la siguiente ciudad (o de regreso). */
  departure: ItineraryItem[];
}

export interface RouteAnalysis {
  stops: StopAnalysis[];
  /** Vuelos o transportes que llegan a la primera ciudad. */
  arrival: ItineraryItem[];
  countries: string[];
  totalNights: number;
  /** Primera llegada y última salida. */
  startDate: string | null;
  endDate: string | null;
  alerts: ItineraryAlert[];
}

function nightsBetween(from: string, to: string): string[] {
  const nights: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) nights.push(d);
  return nights;
}

/** Vuelos/transportes activos cuyas fechas (salida..llegada) tocan el rango [a, b] en cualquier orden. */
function travelsBetween(items: ItineraryItem[], a: string, b: string): ItineraryItem[] {
  const [from, to] = a <= b ? [a, b] : [b, a];
  return items.filter(
    (i) =>
      i.status !== "cancelled" &&
      i.kind !== "lodging" &&
      dayOf(i.start_at) <= to &&
      dayOf(i.end_at ?? i.start_at) >= from,
  );
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Cruza la ruta con el itinerario por fechas: noches sin hospedaje y traslados sin registrar. */
export function analyzeRoute(trip: Trip, route: RouteStop[], items: ItineraryItem[]): RouteAnalysis {
  const lodgings = activeLodgings(items);
  const stops: StopAnalysis[] = route.map((stop, i) => {
    const next = route[i + 1] ?? null;
    const nights = nightsBetween(stop.arrival_date, stop.departure_date);
    // El regreso puede salir después de la última ciudad, hasta el fin del viaje.
    const departureEnd = next
      ? next.arrival_date
      : trip.end_date && trip.end_date > stop.departure_date
        ? trip.end_date
        : stop.departure_date;
    return {
      stop,
      next,
      nights,
      missingNights: nights.filter((n) => !lodgings.some((l) => coversNight(l, n))),
      lodgings: lodgings.filter((l) => nights.some((n) => coversNight(l, n))),
      departure: travelsBetween(items, stop.departure_date, departureEnd),
    };
  });

  const first = route[0];
  const arrival = first
    ? travelsBetween(
        items,
        trip.start_date && trip.start_date < first.arrival_date ? trip.start_date : first.arrival_date,
        first.arrival_date,
      )
    : [];

  const alerts: ItineraryAlert[] = [];
  for (const { stop, next } of stops) {
    if (!next) continue;
    if (next.arrival_date > stop.departure_date) {
      const gap = daysBetween(stop.departure_date, next.arrival_date);
      alerts.push({
        tone: "warning",
        message: `Entre ${stop.city} y ${next.city} hay ${plural(gap, "noche", "noches")} sin ciudad asignada (${formatDate(stop.departure_date)} – ${formatDate(next.arrival_date)}). Si es un trayecto nocturno, ignora este aviso.`,
      });
    } else if (next.arrival_date < stop.departure_date) {
      alerts.push({ tone: "warning", message: `Las fechas de ${stop.city} y ${next.city} se cruzan.` });
    }
  }

  const countries: string[] = [];
  for (const s of route) {
    if (!countries.some((c) => c.toLowerCase() === s.country.toLowerCase())) countries.push(s.country);
  }

  return {
    stops,
    arrival,
    countries,
    totalNights: stops.reduce((sum, s) => sum + s.nights.length, 0),
    startDate: first?.arrival_date ?? null,
    endDate: route.length ? route.reduce((max, s) => (s.departure_date > max ? s.departure_date : max), route[0].departure_date) : null,
    alerts,
  };
}
