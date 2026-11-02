// Acceso a datos: todas las consultas a Supabase viven aquí. Las lecturas con agregados y
// las escrituras de varias tablas son funciones de Postgres (supabase/migrations/*_rpc.sql)
// para que corran en una sola consulta / transacción; el resto usa la API de tablas.
// El acceso por viaje lo controlan las políticas RLS, no este módulo.
import { supabase, unwrap } from "./supabase";
import { roundMoney } from "./format";
import type {
  Contribution,
  Debt,
  ExpenseShare,
  GuestTrip,
  ExpenseWithShares,
  ItineraryItem,
  ItineraryKind,
  ItineraryStatus,
  MemberBalance,
  Person,
  RouteStop,
  Transfer,
  TransferKind,
  TransferScope,
  TripDetail,
  TripListItem,
  WalletBalance,
  WalletDeposit,
} from "../types";

const nullIfEmpty = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

const byName = (a: string, b: string) => a.localeCompare(b, "es", { sensitivity: "base" });

/** Cuenta filas de `table` que cumplen `filter` (sin traerlas). */
async function count(
  table: string,
  filter: (q: ReturnType<ReturnType<typeof supabase.from>["select"]>) => typeof q,
): Promise<number> {
  const { count: n, error } = await filter(supabase.from(table).select("*", { count: "exact", head: true }));
  if (error) throw new Error(error.message);
  return n ?? 0;
}

// ─── Personas ──────────────────────────────────────────────────────────────

export interface PersonInput {
  name: string;
  phone?: string | null;
  notes?: string | null;
}

export async function listPeople(): Promise<(Person & { trip_count: number })[]> {
  return unwrap(await supabase.rpc("list_people"));
}

const personRow = (input: PersonInput) => ({
  name: input.name.trim(),
  phone: nullIfEmpty(input.phone),
  notes: nullIfEmpty(input.notes),
});

export async function createPerson(input: PersonInput): Promise<number> {
  const { id } = unwrap(await supabase.from("people").insert(personRow(input)).select("id").single());
  return id;
}

export async function updatePerson(id: number, input: PersonInput): Promise<void> {
  unwrap(await supabase.from("people").update(personRow(input)).eq("id", id));
}

export async function deletePerson(id: number): Promise<void> {
  const n = await count("trip_members", (q) => q.eq("person_id", id));
  if (n > 0) throw new Error("La persona está asignada a uno o más viajes. Quítala de ellos primero.");
  unwrap(await supabase.from("people").delete().eq("id", id));
}

// ─── Viajes ────────────────────────────────────────────────────────────────

export interface TripInput {
  name: string;
  destination?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  currency: string;
  notes?: string | null;
}

export async function listTrips(): Promise<TripListItem[]> {
  return unwrap(await supabase.rpc("list_trips"));
}

/** Los códigos del viaje no se leen de la tabla (los visitantes no deben verlos): van por get_trip. */
export async function getTrip(id: number): Promise<TripDetail | null> {
  return unwrap(await supabase.rpc("get_trip", { p_trip_id: id }).maybeSingle());
}

const tripRow = (input: TripInput) => ({
  name: input.name.trim(),
  destination: nullIfEmpty(input.destination),
  start_date: nullIfEmpty(input.start_date),
  end_date: nullIfEmpty(input.end_date),
  currency: input.currency,
  notes: nullIfEmpty(input.notes),
});

export async function createTrip(input: TripInput, memberIds: number[]): Promise<number> {
  const { id: tripId } = unwrap(await supabase.from("trips").insert(tripRow(input)).select("id").single());
  for (const personId of memberIds) await addMember(tripId, personId);
  return tripId;
}

export async function updateTrip(id: number, input: TripInput): Promise<void> {
  unwrap(await supabase.from("trips").update(tripRow(input)).eq("id", id));
}

/** Borra el viaje; aportes, gastos, préstamos, itinerario y ruta se van en cascada. */
export async function deleteTrip(id: number): Promise<void> {
  const deleted = unwrap(await supabase.from("trips").delete().eq("id", id).select("id"));
  if (deleted.length === 0) throw new Error("Solo quien creó el viaje puede eliminarlo.");
}

/** Da acceso al viaje del código a la cuenta actual. Devuelve el id del viaje. */
export async function joinTrip(code: string): Promise<number> {
  return unwrap(await supabase.rpc("join_trip", { p_code: code }));
}

// ─── Link de invitado ──────────────────────────────────────────────────────

/** Activa el código de visitante con uno nuevo (o lo desactiva). Devuelve el código o null. */
export async function setViewerCode(tripId: number, enabled: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc("set_viewer_code", { p_trip_id: tripId, p_enabled: enabled });
  if (error) throw new Error(error.message);
  return data;
}

/** Activa el link de invitado con un código nuevo (o lo desactiva). Devuelve el código o null. */
export async function setGuestCode(tripId: number, enabled: boolean): Promise<string | null> {
  const { data, error } = await supabase.rpc("set_guest_code", { p_trip_id: tripId, p_enabled: enabled });
  if (error) throw new Error(error.message);
  return data;
}

/** Itinerario y ruta del viaje del código; no requiere sesión. null si el link no existe o se desactivó. */
export async function getGuestTrip(code: string): Promise<GuestTrip | null> {
  const { data, error } = await supabase.rpc("guest_trip", { p_code: code });
  if (error) throw new Error(error.message);
  return data;
}

export function guestUrl(code: string): string {
  return `${window.location.origin}${window.location.pathname}#/invitado/${code}`;
}

// ─── Cuentas del viaje ─────────────────────────────────────────────────────

/**
 * Participante que es la cuenta actual en el viaje y participantes ya vinculados a otras
 * cuentas. Un vínculo a alguien que ya no es integrante se ignora.
 */
export async function getPersonLinks(
  tripId: number,
  memberIds: number[],
): Promise<{ myPersonId: number | null; claimedPersonIds: number[] }> {
  const [{ data: auth }, rows] = await Promise.all([
    supabase.auth.getSession(),
    supabase.from("trip_users").select("user_id, person_id").eq("trip_id", tripId).then(unwrap),
  ]);
  const me = auth.session?.user.id;
  const linked = rows.filter((r) => r.person_id != null && memberIds.includes(r.person_id));
  return {
    myPersonId: linked.find((r) => r.user_id === me)?.person_id ?? null,
    claimedPersonIds: linked.filter((r) => r.user_id !== me).map((r) => r.person_id),
  };
}

/** Vincula la cuenta actual con un participante del viaje (null lo desvincula). */
export async function setMyPerson(tripId: number, personId: number | null): Promise<void> {
  unwrap(await supabase.rpc("set_my_person", { p_trip_id: tripId, p_person_id: personId }));
}

// ─── Integrantes ───────────────────────────────────────────────────────────

export async function listMembers(tripId: number): Promise<Person[]> {
  const rows = unwrap(
    await supabase.from("trip_members").select("person:people(*)").eq("trip_id", tripId),
  ) as unknown as { person: Person }[];
  return rows.map((r) => r.person).sort((a, b) => byName(a.name, b.name));
}

export async function addMember(tripId: number, personId: number): Promise<void> {
  unwrap(
    await supabase
      .from("trip_members")
      .upsert({ trip_id: tripId, person_id: personId }, { onConflict: "trip_id,person_id", ignoreDuplicates: true }),
  );
}

export async function removeMember(tripId: number, personId: number): Promise<void> {
  unwrap(await supabase.rpc("remove_trip_member", { p_trip_id: tripId, p_person_id: personId }));
}

// ─── Aportes (presupuesto) ─────────────────────────────────────────────────

export interface ContributionInput {
  person_id: number;
  amount: number;
  date: string;
  note?: string | null;
}

/** Aplana `person: { name }` del embed de PostgREST a `person_name`. */
function withPersonName<T extends { person: { name: string } | null }>(rows: T[]) {
  return rows.map(({ person, ...rest }) => ({ ...rest, person_name: person?.name ?? "" }));
}

export async function listContributions(tripId: number): Promise<Contribution[]> {
  const rows = unwrap(
    await supabase
      .from("contributions")
      .select("*, person:people(name)")
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("id", { ascending: false }),
  );
  return withPersonName(rows) as Contribution[];
}

const contributionRow = (input: ContributionInput) => ({
  person_id: input.person_id,
  amount: input.amount,
  date: input.date,
  note: nullIfEmpty(input.note),
});

export async function createContribution(tripId: number, input: ContributionInput): Promise<void> {
  unwrap(await supabase.from("contributions").insert({ trip_id: tripId, ...contributionRow(input) }));
}

export async function updateContribution(id: number, input: ContributionInput): Promise<void> {
  unwrap(await supabase.from("contributions").update(contributionRow(input)).eq("id", id));
}

export async function deleteContribution(id: number): Promise<void> {
  unwrap(await supabase.from("contributions").delete().eq("id", id));
}

// ─── Gastos ────────────────────────────────────────────────────────────────

export interface ExpenseInput {
  category: string;
  description: string;
  amount: number;
  date: string;
  notes?: string | null;
  paid_by_person_id: number | null;
  shares: { person_id: number; amount: number }[];
}

export async function listExpenses(tripId: number): Promise<ExpenseWithShares[]> {
  const rows = unwrap(
    await supabase
      .from("expenses")
      .select(
        `*, paid_by:people!expenses_paid_by_person_id_fkey(name),
         shares:expense_shares(expense_id, person_id, amount, person:people(name))`,
      )
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("id", { ascending: false }),
  );
  return rows.map(({ paid_by, shares, ...e }) => ({
    ...e,
    paid_by_name: paid_by?.name ?? null,
    shares: (withPersonName(shares) as ExpenseShare[]).sort((a, b) => byName(a.person_name, b.person_name)),
  })) as ExpenseWithShares[];
}

async function saveExpense(tripId: number | null, expenseId: number | null, input: ExpenseInput) {
  unwrap(
    await supabase.rpc("save_expense", {
      p_trip_id: tripId,
      p_expense_id: expenseId,
      p_category: input.category,
      p_description: input.description.trim(),
      p_amount: input.amount,
      p_date: input.date,
      p_notes: nullIfEmpty(input.notes),
      p_paid_by: input.paid_by_person_id,
      p_shares: input.shares,
    }),
  );
}

export async function createExpense(tripId: number, input: ExpenseInput): Promise<void> {
  await saveExpense(tripId, null, input);
}

/** Actualiza el gasto y sus partes; los préstamos que lo cubren siguen la nueva parte del deudor. */
export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  await saveExpense(null, id, input);
}

export async function deleteExpense(id: number): Promise<void> {
  const n = await count("transfers", (q) => q.eq("expense_id", id));
  if (n > 0) {
    throw new Error("Este gasto tiene préstamos que lo cubren. Elimínalos primero en la pestaña Préstamos.");
  }
  // Las partes se borran en cascada.
  unwrap(await supabase.from("expenses").delete().eq("id", id));
}

// ─── Itinerario ────────────────────────────────────────────────────────────

export interface ItineraryInput {
  kind: ItineraryKind;
  status: ItineraryStatus;
  provider?: string | null;
  reference?: string | null;
  origin?: string | null;
  destination?: string | null;
  address?: string | null;
  start_at: string;
  end_at?: string | null;
  confirmation_code?: string | null;
  notes?: string | null;
}

export async function listItinerary(tripId: number): Promise<ItineraryItem[]> {
  return unwrap(
    await supabase.from("itinerary_items").select("*").eq("trip_id", tripId).order("start_at").order("id"),
  );
}

const itineraryRow = (input: ItineraryInput) => ({
  kind: input.kind,
  status: input.status,
  provider: nullIfEmpty(input.provider),
  reference: nullIfEmpty(input.reference),
  origin: nullIfEmpty(input.origin),
  destination: nullIfEmpty(input.destination),
  address: nullIfEmpty(input.address),
  start_at: input.start_at,
  end_at: nullIfEmpty(input.end_at),
  confirmation_code: nullIfEmpty(input.confirmation_code),
  notes: nullIfEmpty(input.notes),
});

export async function createItineraryItem(tripId: number, input: ItineraryInput): Promise<void> {
  unwrap(await supabase.from("itinerary_items").insert({ trip_id: tripId, ...itineraryRow(input) }));
}

export async function updateItineraryItem(id: number, input: ItineraryInput): Promise<void> {
  unwrap(await supabase.from("itinerary_items").update(itineraryRow(input)).eq("id", id));
}

export async function deleteItineraryItem(id: number): Promise<void> {
  unwrap(await supabase.from("itinerary_items").delete().eq("id", id));
}

// ─── Ruta ──────────────────────────────────────────────────────────────────

export interface RouteStopInput {
  country: string;
  city: string;
  arrival_date: string;
  departure_date: string;
  notes?: string | null;
}

export async function listRouteStops(tripId: number): Promise<RouteStop[]> {
  return unwrap(
    await supabase
      .from("route_stops")
      .select("*")
      .eq("trip_id", tripId)
      .order("arrival_date")
      .order("departure_date")
      .order("id"),
  );
}

const routeStopRow = (input: RouteStopInput) => ({
  country: input.country.trim(),
  city: input.city.trim(),
  arrival_date: input.arrival_date,
  departure_date: input.departure_date,
  notes: nullIfEmpty(input.notes),
});

export async function createRouteStop(tripId: number, input: RouteStopInput): Promise<void> {
  unwrap(await supabase.from("route_stops").insert({ trip_id: tripId, ...routeStopRow(input) }));
}

export async function updateRouteStop(id: number, input: RouteStopInput): Promise<void> {
  unwrap(await supabase.from("route_stops").update(routeStopRow(input)).eq("id", id));
}

export async function deleteRouteStop(id: number): Promise<void> {
  unwrap(await supabase.from("route_stops").delete().eq("id", id));
}

/** Ajusta inicio y fin del viaje a la primera llegada y la última salida de la ruta. */
export async function setTripDates(id: number, startDate: string, endDate: string): Promise<void> {
  unwrap(await supabase.from("trips").update({ start_date: startDate, end_date: endDate }).eq("id", id));
}

// ─── Préstamos / devoluciones ──────────────────────────────────────────────

export interface TransferInput {
  from_person_id: number;
  to_person_id: number;
  kind: TransferKind;
  scope: TransferScope;
  amount: number;
  date: string;
  note?: string | null;
  expense_id?: number | null;
}

export async function listTransfers(tripId: number): Promise<Transfer[]> {
  const rows = unwrap(
    await supabase
      .from("transfers")
      .select(
        `*, from:people!transfers_from_person_id_fkey(name), to:people!transfers_to_person_id_fkey(name),
         expense:expenses!transfers_expense_id_fkey(description)`,
      )
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("id", { ascending: false }),
  );
  return rows.map(({ from, to, expense, ...t }) => ({
    ...t,
    from_name: from?.name ?? "",
    to_name: to?.name ?? "",
    expense_description: expense?.description ?? null,
  })) as Transfer[];
}

const transferRow = (input: TransferInput) => ({
  from_person_id: input.from_person_id,
  to_person_id: input.to_person_id,
  kind: input.kind,
  amount: input.amount,
  date: input.date,
  note: nullIfEmpty(input.note),
  expense_id: input.expense_id ?? null,
  scope: input.scope,
});

export async function createTransfer(tripId: number, input: TransferInput): Promise<void> {
  unwrap(await supabase.from("transfers").insert({ trip_id: tripId, ...transferRow(input) }));
}

export async function updateTransfer(id: number, input: TransferInput): Promise<void> {
  unwrap(await supabase.from("transfers").update(transferRow(input)).eq("id", id));
}

export async function deleteTransfer(id: number): Promise<void> {
  unwrap(await supabase.from("transfers").delete().eq("id", id));
}

// ─── Balances ──────────────────────────────────────────────────────────────

export async function getBalances(tripId: number): Promise<MemberBalance[]> {
  const rows: Omit<MemberBalance, "available" | "net_debt">[] = unwrap(
    await supabase.rpc("trip_balances", { p_trip_id: tripId }),
  );
  return rows.map((r) => ({
    ...r,
    available: r.budget - r.spent - r.transfers_out + r.transfers_in - r.covered_out + r.covered_in,
    net_debt: r.transfers_in - r.transfers_out + r.covered_in - r.covered_out,
  }));
}

// ─── Billetera ─────────────────────────────────────────────────────────────

export interface WalletDepositInput {
  person_id: number;
  amount: number;
  date: string;
  note?: string | null;
}

export async function listWalletDeposits(tripId: number): Promise<WalletDeposit[]> {
  const rows = unwrap(
    await supabase
      .from("wallet_deposits")
      .select("*, person:people(name)")
      .eq("trip_id", tripId)
      .order("date", { ascending: false })
      .order("id", { ascending: false }),
  );
  return withPersonName(rows) as WalletDeposit[];
}

const walletDepositRow = (input: WalletDepositInput) => ({
  person_id: input.person_id,
  amount: input.amount,
  date: input.date,
  note: nullIfEmpty(input.note),
});

export async function createWalletDeposit(tripId: number, input: WalletDepositInput): Promise<void> {
  unwrap(await supabase.from("wallet_deposits").insert({ trip_id: tripId, ...walletDepositRow(input) }));
}

export async function updateWalletDeposit(id: number, input: WalletDepositInput): Promise<void> {
  unwrap(await supabase.from("wallet_deposits").update(walletDepositRow(input)).eq("id", id));
}

export async function deleteWalletDeposit(id: number): Promise<void> {
  unwrap(await supabase.from("wallet_deposits").delete().eq("id", id));
}

export async function getWalletBalances(tripId: number): Promise<WalletBalance[]> {
  const rows: Omit<WalletBalance, "balance" | "net_debt">[] = unwrap(
    await supabase.rpc("wallet_balances", { p_trip_id: tripId }),
  );
  return rows.map((r) => ({
    ...r,
    balance: r.deposits - r.contributed - r.given + r.received,
    net_debt: r.received - r.given,
  }));
}

/** Dinero que pasó de una persona a otra: préstamos, devoluciones y partes cubiertas por un pagador. */
interface MoneyFlow {
  from: number;
  fromName: string;
  to: number;
  toName: string;
  amount: number;
}

function moneyFlows(transfers: Transfer[], expenses: ExpenseWithShares[]): MoneyFlow[] {
  const flows: MoneyFlow[] = transfers.map((t) => ({
    from: t.from_person_id,
    fromName: t.from_name,
    to: t.to_person_id,
    toName: t.to_name,
    amount: t.amount,
  }));
  for (const e of expenses) {
    if (e.paid_by_person_id == null) continue;
    for (const s of e.shares) {
      if (s.person_id === e.paid_by_person_id) continue;
      flows.push({
        from: e.paid_by_person_id,
        fromName: e.paid_by_name ?? "",
        to: s.person_id,
        toName: s.person_name,
        amount: s.amount,
      });
    }
  }
  return flows;
}

/**
 * Deudas pendientes por pareja. Todo dinero que va de A hacia B (préstamo, devolución o
 * parte de un gasto que A pagó por B) aumenta lo que B le debe a A; el neto de cada
 * pareja define quién le debe a quién.
 */
export function computeDebts(
  transfers: Transfer[],
  expenses: ExpenseWithShares[],
  currency: string,
): Debt[] {
  const pairs = new Map<string, { a: [number, string]; b: [number, string]; aToB: number }>();
  for (const f of moneyFlows(transfers, expenses)) {
    const lo: [number, string] = f.from < f.to ? [f.from, f.fromName] : [f.to, f.toName];
    const hi: [number, string] = f.from < f.to ? [f.to, f.toName] : [f.from, f.fromName];
    const key = `${lo[0]}-${hi[0]}`;
    const entry = pairs.get(key) ?? { a: lo, b: hi, aToB: 0 };
    entry.aToB += f.from === entry.a[0] ? f.amount : -f.amount;
    pairs.set(key, entry);
  }
  const debts: Debt[] = [];
  for (const { a, b, aToB } of pairs.values()) {
    // Las partes exactas dejan residuos de fracción de peso: por debajo de media unidad no hay deuda.
    if (roundMoney(aToB, currency) === 0) continue;
    const [creditor, debtor] = aToB > 0 ? [a, b] : [b, a];
    debts.push({
      debtor_id: debtor[0],
      debtor_name: debtor[1],
      creditor_id: creditor[0],
      creditor_name: creditor[1],
      amount: Math.abs(aToB),
    });
  }
  return debts.sort((x, y) => y.amount - x.amount);
}

/**
 * Efecto de un gasto sobre el disponible de una persona: resta su parte y, si hay pagador,
 * el pagador además pone las partes de los demás y ellos no tocan su dinero.
 */
export function expenseEffect(
  shares: { person_id: number; amount: number }[],
  paidBy: number | null,
  personId: number,
): number {
  const own = shares.find((s) => s.person_id === personId)?.amount ?? 0;
  if (paidBy == null) return -own;
  if (personId === paidBy) return -shares.reduce((sum, s) => sum + s.amount, 0);
  return 0;
}
