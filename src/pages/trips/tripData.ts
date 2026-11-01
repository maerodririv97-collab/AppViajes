import type {
  Contribution,
  Debt,
  ExpenseWithShares,
  ItineraryItem,
  MemberBalance,
  Person,
  RouteStop,
  Transfer,
  Trip,
  WalletBalance,
  WalletDeposit,
} from "../../types";

/** Todo lo que necesita la vista de un viaje; se carga una sola vez y se pasa a las pestañas. */
export interface TripData {
  trip: Trip;
  members: Person[];
  balances: MemberBalance[];
  contributions: Contribution[];
  expenses: ExpenseWithShares[];
  /** Préstamos y devoluciones del presupuesto (scope = budget). */
  transfers: Transfer[];
  /** Deudas del presupuesto: gastos pagados por otro y préstamos que cubren partes de gastos. */
  debts: Debt[];
  deposits: WalletDeposit[];
  walletBalances: WalletBalance[];
  /** Préstamos libres y devoluciones entre billeteras (scope = wallet). */
  walletTransfers: Transfer[];
  walletDebts: Debt[];
  /** Vuelos, hospedajes y transportes ordenados por fecha de inicio. */
  itinerary: ItineraryItem[];
  /** Ciudades del viaje ordenadas por fecha de llegada. */
  route: RouteStop[];
  /** Participante que es la cuenta actual en este viaje; null si aún no lo eligió. */
  myPersonId: number | null;
  /** Participantes ya vinculados a otras cuentas (no se pueden elegir). */
  claimedPersonIds: number[];
}
