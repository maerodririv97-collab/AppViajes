// Acceso a datos: todas las consultas SQL de la app viven aquí.
// Nota: tauri-plugin-sql usa un pool de conexiones, así que BEGIN/COMMIT en llamadas
// separadas no garantiza la misma conexión. Las escrituras de varias tablas se hacen en
// orden seguro y, si falla un paso, se deshace a mano lo ya insertado.
import { getDb } from "./db";
import { roundMoney } from "./format";
import type {
  Contribution,
  Debt,
  Expense,
  ExpenseShare,
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
  Trip,
  TripListItem,
  WalletBalance,
  WalletDeposit,
} from "../types";

const nullIfEmpty = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

// ─── Personas ──────────────────────────────────────────────────────────────

export interface PersonInput {
  name: string;
  phone?: string | null;
  notes?: string | null;
}

export async function listPeople(): Promise<(Person & { trip_count: number })[]> {
  const db = await getDb();
  return db.select(
    `SELECT p.*, (SELECT COUNT(*) FROM trip_members m WHERE m.person_id = p.id) AS trip_count
     FROM people p ORDER BY p.name COLLATE NOCASE`,
  );
}

export async function createPerson(input: PersonInput): Promise<number> {
  const db = await getDb();
  const res = await db.execute("INSERT INTO people (name, phone, notes) VALUES ($1, $2, $3)", [
    input.name.trim(),
    nullIfEmpty(input.phone),
    nullIfEmpty(input.notes),
  ]);
  return res.lastInsertId as number;
}

export async function updatePerson(id: number, input: PersonInput): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE people SET name = $1, phone = $2, notes = $3 WHERE id = $4", [
    input.name.trim(),
    nullIfEmpty(input.phone),
    nullIfEmpty(input.notes),
    id,
  ]);
}

export async function deletePerson(id: number): Promise<void> {
  const db = await getDb();
  const [{ n }] = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM trip_members WHERE person_id = $1",
    [id],
  );
  if (n > 0) throw new Error("La persona está asignada a uno o más viajes. Quítala de ellos primero.");
  await db.execute("DELETE FROM people WHERE id = $1", [id]);
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
  const db = await getDb();
  return db.select(
    `SELECT t.*,
       (SELECT COUNT(*) FROM trip_members m WHERE m.trip_id = t.id) AS member_count,
       COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.trip_id = t.id), 0) AS total_budget,
       COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.trip_id = t.id), 0) AS total_spent
     FROM trips t
     ORDER BY COALESCE(t.start_date, t.created_at) DESC, t.id DESC`,
  );
}

export async function getTrip(id: number): Promise<Trip | null> {
  const db = await getDb();
  const rows = await db.select<Trip[]>("SELECT * FROM trips WHERE id = $1", [id]);
  return rows[0] ?? null;
}

export async function createTrip(input: TripInput, memberIds: number[]): Promise<number> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO trips (name, destination, start_date, end_date, currency, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.name.trim(),
      nullIfEmpty(input.destination),
      nullIfEmpty(input.start_date),
      nullIfEmpty(input.end_date),
      input.currency,
      nullIfEmpty(input.notes),
    ],
  );
  const tripId = res.lastInsertId as number;
  for (const personId of memberIds) await addMember(tripId, personId);
  return tripId;
}

export async function updateTrip(id: number, input: TripInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE trips SET name = $1, destination = $2, start_date = $3, end_date = $4,
       currency = $5, notes = $6 WHERE id = $7`,
    [
      input.name.trim(),
      nullIfEmpty(input.destination),
      nullIfEmpty(input.start_date),
      nullIfEmpty(input.end_date),
      input.currency,
      nullIfEmpty(input.notes),
      id,
    ],
  );
}

export async function deleteTrip(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    "DELETE FROM expense_shares WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = $1)",
    [id],
  );
  await db.execute("DELETE FROM expenses WHERE trip_id = $1", [id]);
  await db.execute("DELETE FROM transfers WHERE trip_id = $1", [id]);
  await db.execute("DELETE FROM contributions WHERE trip_id = $1", [id]);
  await db.execute("DELETE FROM wallet_deposits WHERE trip_id = $1", [id]);
  await db.execute("DELETE FROM itinerary_items WHERE trip_id = $1", [id]);
  await db.execute("DELETE FROM route_stops WHERE trip_id = $1", [id]);
  await db.execute("DELETE FROM trip_members WHERE trip_id = $1", [id]);
  await db.execute("DELETE FROM trips WHERE id = $1", [id]);
}

// ─── Integrantes ───────────────────────────────────────────────────────────

export async function listMembers(tripId: number): Promise<Person[]> {
  const db = await getDb();
  return db.select(
    `SELECT p.* FROM trip_members m JOIN people p ON p.id = m.person_id
     WHERE m.trip_id = $1 ORDER BY p.name COLLATE NOCASE`,
    [tripId],
  );
}

export async function addMember(tripId: number, personId: number): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT OR IGNORE INTO trip_members (trip_id, person_id) VALUES ($1, $2)", [
    tripId,
    personId,
  ]);
}

export async function removeMember(tripId: number, personId: number): Promise<void> {
  const db = await getDb();
  const [{ n }] = await db.select<{ n: number }[]>(
    `SELECT
       (SELECT COUNT(*) FROM contributions WHERE trip_id = $1 AND person_id = $2)
     + (SELECT COUNT(*) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
          WHERE e.trip_id = $1 AND s.person_id = $2)
     + (SELECT COUNT(*) FROM transfers WHERE trip_id = $1 AND (from_person_id = $2 OR to_person_id = $2))
     + (SELECT COUNT(*) FROM expenses WHERE trip_id = $1 AND paid_by_person_id = $2)
     + (SELECT COUNT(*) FROM wallet_deposits WHERE trip_id = $1 AND person_id = $2)
     AS n`,
    [tripId, personId],
  );
  if (n > 0) {
    throw new Error(
      "La persona tiene movimientos de billetera, aportes, gastos o préstamos en este viaje. Elimina esos movimientos antes de quitarla.",
    );
  }
  await db.execute("DELETE FROM trip_members WHERE trip_id = $1 AND person_id = $2", [tripId, personId]);
}

// ─── Aportes (presupuesto) ─────────────────────────────────────────────────

export interface ContributionInput {
  person_id: number;
  amount: number;
  date: string;
  note?: string | null;
}

export async function listContributions(tripId: number): Promise<Contribution[]> {
  const db = await getDb();
  return db.select(
    `SELECT c.*, p.name AS person_name FROM contributions c JOIN people p ON p.id = c.person_id
     WHERE c.trip_id = $1 ORDER BY c.date DESC, c.id DESC`,
    [tripId],
  );
}

export async function createContribution(tripId: number, input: ContributionInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO contributions (trip_id, person_id, amount, date, note) VALUES ($1, $2, $3, $4, $5)",
    [tripId, input.person_id, input.amount, input.date, nullIfEmpty(input.note)],
  );
}

export async function updateContribution(id: number, input: ContributionInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE contributions SET person_id = $1, amount = $2, date = $3, note = $4 WHERE id = $5",
    [input.person_id, input.amount, input.date, nullIfEmpty(input.note), id],
  );
}

export async function deleteContribution(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM contributions WHERE id = $1", [id]);
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
  const db = await getDb();
  const expenses = await db.select<Expense[]>(
    `SELECT e.*, p.name AS paid_by_name FROM expenses e
     LEFT JOIN people p ON p.id = e.paid_by_person_id
     WHERE e.trip_id = $1 ORDER BY e.date DESC, e.id DESC`,
    [tripId],
  );
  const shares = await db.select<ExpenseShare[]>(
    `SELECT s.expense_id, s.person_id, p.name AS person_name, s.amount
     FROM expense_shares s
     JOIN expenses e ON e.id = s.expense_id
     JOIN people p ON p.id = s.person_id
     WHERE e.trip_id = $1 ORDER BY p.name COLLATE NOCASE`,
    [tripId],
  );
  const byExpense = new Map<number, ExpenseShare[]>();
  for (const s of shares) {
    const list = byExpense.get(s.expense_id) ?? [];
    list.push(s);
    byExpense.set(s.expense_id, list);
  }
  return expenses.map((e) => ({ ...e, shares: byExpense.get(e.id) ?? [] }));
}

async function insertShares(expenseId: number, shares: ExpenseInput["shares"]): Promise<void> {
  if (shares.length === 0) return;
  const db = await getDb();
  const values = shares.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ");
  const params: (number | string)[] = [expenseId];
  for (const s of shares) params.push(s.person_id, s.amount);
  await db.execute(`INSERT INTO expense_shares (expense_id, person_id, amount) VALUES ${values}`, params);
}

export async function createExpense(tripId: number, input: ExpenseInput): Promise<void> {
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO expenses (trip_id, category, description, amount, date, notes, paid_by_person_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      tripId,
      input.category,
      input.description.trim(),
      input.amount,
      input.date,
      nullIfEmpty(input.notes),
      input.paid_by_person_id,
    ],
  );
  const expenseId = res.lastInsertId as number;
  try {
    await insertShares(expenseId, input.shares);
  } catch (err) {
    await db.execute("DELETE FROM expenses WHERE id = $1", [expenseId]);
    throw err;
  }
}

export async function updateExpense(id: number, input: ExpenseInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE expenses SET category = $1, description = $2, amount = $3, date = $4, notes = $5,
       paid_by_person_id = $6 WHERE id = $7`,
    [
      input.category,
      input.description.trim(),
      input.amount,
      input.date,
      nullIfEmpty(input.notes),
      input.paid_by_person_id,
      id,
    ],
  );
  await db.execute("DELETE FROM expense_shares WHERE expense_id = $1", [id]);
  await insertShares(id, input.shares);
  // Los préstamos que cubren este gasto siguen la nueva parte del deudor; si ya no participa,
  // el préstamo se conserva como monto libre.
  await db.execute(
    `UPDATE transfers SET amount = (SELECT s.amount FROM expense_shares s
        WHERE s.expense_id = transfers.expense_id AND s.person_id = transfers.to_person_id)
     WHERE expense_id = $1 AND EXISTS (SELECT 1 FROM expense_shares s
        WHERE s.expense_id = transfers.expense_id AND s.person_id = transfers.to_person_id)`,
    [id],
  );
  await db.execute(
    `UPDATE transfers SET expense_id = NULL
     WHERE expense_id = $1 AND NOT EXISTS (SELECT 1 FROM expense_shares s
        WHERE s.expense_id = transfers.expense_id AND s.person_id = transfers.to_person_id)`,
    [id],
  );
}

export async function deleteExpense(id: number): Promise<void> {
  const db = await getDb();
  const [{ n }] = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM transfers WHERE expense_id = $1",
    [id],
  );
  if (n > 0) {
    throw new Error("Este gasto tiene préstamos que lo cubren. Elimínalos primero en la pestaña Préstamos.");
  }
  await db.execute("DELETE FROM expense_shares WHERE expense_id = $1", [id]);
  await db.execute("DELETE FROM expenses WHERE id = $1", [id]);
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
  const db = await getDb();
  return db.select(
    "SELECT * FROM itinerary_items WHERE trip_id = $1 ORDER BY start_at, id",
    [tripId],
  );
}

const itineraryParams = (input: ItineraryInput) => [
  input.kind,
  input.status,
  nullIfEmpty(input.provider),
  nullIfEmpty(input.reference),
  nullIfEmpty(input.origin),
  nullIfEmpty(input.destination),
  nullIfEmpty(input.address),
  input.start_at,
  nullIfEmpty(input.end_at),
  nullIfEmpty(input.confirmation_code),
  nullIfEmpty(input.notes),
];

export async function createItineraryItem(tripId: number, input: ItineraryInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO itinerary_items (kind, status, provider, reference, origin, destination, address,
       start_at, end_at, confirmation_code, notes, trip_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [...itineraryParams(input), tripId],
  );
}

export async function updateItineraryItem(id: number, input: ItineraryInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE itinerary_items SET kind = $1, status = $2, provider = $3, reference = $4, origin = $5,
       destination = $6, address = $7, start_at = $8, end_at = $9, confirmation_code = $10, notes = $11
     WHERE id = $12`,
    [...itineraryParams(input), id],
  );
}

export async function deleteItineraryItem(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM itinerary_items WHERE id = $1", [id]);
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
  const db = await getDb();
  return db.select(
    "SELECT * FROM route_stops WHERE trip_id = $1 ORDER BY arrival_date, departure_date, id",
    [tripId],
  );
}

export async function createRouteStop(tripId: number, input: RouteStopInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO route_stops (trip_id, country, city, arrival_date, departure_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tripId, input.country.trim(), input.city.trim(), input.arrival_date, input.departure_date, nullIfEmpty(input.notes)],
  );
}

export async function updateRouteStop(id: number, input: RouteStopInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE route_stops SET country = $1, city = $2, arrival_date = $3, departure_date = $4, notes = $5
     WHERE id = $6`,
    [input.country.trim(), input.city.trim(), input.arrival_date, input.departure_date, nullIfEmpty(input.notes), id],
  );
}

export async function deleteRouteStop(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM route_stops WHERE id = $1", [id]);
}

/** Ajusta inicio y fin del viaje a la primera llegada y la última salida de la ruta. */
export async function setTripDates(id: number, startDate: string, endDate: string): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE trips SET start_date = $1, end_date = $2 WHERE id = $3", [startDate, endDate, id]);
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
  const db = await getDb();
  return db.select(
    `SELECT t.*, pf.name AS from_name, pt.name AS to_name, e.description AS expense_description
     FROM transfers t
     JOIN people pf ON pf.id = t.from_person_id
     JOIN people pt ON pt.id = t.to_person_id
     LEFT JOIN expenses e ON e.id = t.expense_id
     WHERE t.trip_id = $1 ORDER BY t.date DESC, t.id DESC`,
    [tripId],
  );
}

export async function createTransfer(tripId: number, input: TransferInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO transfers (trip_id, from_person_id, to_person_id, kind, amount, date, note, expense_id, scope)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      tripId,
      input.from_person_id,
      input.to_person_id,
      input.kind,
      input.amount,
      input.date,
      nullIfEmpty(input.note),
      input.expense_id ?? null,
      input.scope,
    ],
  );
}

export async function updateTransfer(id: number, input: TransferInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE transfers SET from_person_id = $1, to_person_id = $2, kind = $3, amount = $4,
       date = $5, note = $6, expense_id = $7, scope = $8 WHERE id = $9`,
    [
      input.from_person_id,
      input.to_person_id,
      input.kind,
      input.amount,
      input.date,
      nullIfEmpty(input.note),
      input.expense_id ?? null,
      input.scope,
      id,
    ],
  );
}

export async function deleteTransfer(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM transfers WHERE id = $1", [id]);
}

// ─── Balances ──────────────────────────────────────────────────────────────

export async function getBalances(tripId: number): Promise<MemberBalance[]> {
  const db = await getDb();
  const rows = await db.select<Omit<MemberBalance, "available" | "net_debt">[]>(
    `SELECT p.id AS person_id, p.name,
       COALESCE((SELECT SUM(c.amount) FROM contributions c
                 WHERE c.trip_id = m.trip_id AND c.person_id = p.id), 0) AS budget,
       COALESCE((SELECT SUM(s.amount) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                 WHERE e.trip_id = m.trip_id AND s.person_id = p.id), 0) AS spent,
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'budget'
                   AND t.from_person_id = p.id), 0) AS transfers_out,
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'budget'
                   AND t.to_person_id = p.id), 0) AS transfers_in,
       COALESCE((SELECT SUM(s.amount) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                 WHERE e.trip_id = m.trip_id AND e.paid_by_person_id = p.id
                   AND s.person_id <> p.id), 0) AS covered_out,
       COALESCE((SELECT SUM(s.amount) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                 WHERE e.trip_id = m.trip_id AND s.person_id = p.id
                   AND e.paid_by_person_id IS NOT NULL AND e.paid_by_person_id <> p.id), 0) AS covered_in
     FROM trip_members m JOIN people p ON p.id = m.person_id
     WHERE m.trip_id = $1
     ORDER BY p.name COLLATE NOCASE`,
    [tripId],
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
  const db = await getDb();
  return db.select(
    `SELECT w.*, p.name AS person_name FROM wallet_deposits w JOIN people p ON p.id = w.person_id
     WHERE w.trip_id = $1 ORDER BY w.date DESC, w.id DESC`,
    [tripId],
  );
}

export async function createWalletDeposit(tripId: number, input: WalletDepositInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO wallet_deposits (trip_id, person_id, amount, date, note) VALUES ($1, $2, $3, $4, $5)",
    [tripId, input.person_id, input.amount, input.date, nullIfEmpty(input.note)],
  );
}

export async function updateWalletDeposit(id: number, input: WalletDepositInput): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE wallet_deposits SET person_id = $1, amount = $2, date = $3, note = $4 WHERE id = $5",
    [input.person_id, input.amount, input.date, nullIfEmpty(input.note), id],
  );
}

export async function deleteWalletDeposit(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM wallet_deposits WHERE id = $1", [id]);
}

export async function getWalletBalances(tripId: number): Promise<WalletBalance[]> {
  const db = await getDb();
  const rows = await db.select<Omit<WalletBalance, "balance" | "net_debt">[]>(
    `SELECT p.id AS person_id, p.name,
       COALESCE((SELECT SUM(w.amount) FROM wallet_deposits w
                 WHERE w.trip_id = m.trip_id AND w.person_id = p.id), 0) AS deposits,
       COALESCE((SELECT SUM(c.amount) FROM contributions c
                 WHERE c.trip_id = m.trip_id AND c.person_id = p.id), 0) AS contributed,
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'wallet'
                   AND t.from_person_id = p.id), 0) AS given,
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'wallet'
                   AND t.to_person_id = p.id), 0) AS received
     FROM trip_members m JOIN people p ON p.id = m.person_id
     WHERE m.trip_id = $1
     ORDER BY p.name COLLATE NOCASE`,
    [tripId],
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
