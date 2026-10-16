export interface Person {
  id: number;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface Trip {
  id: number;
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
}

export interface TripListItem extends Trip {
  member_count: number;
  total_budget: number;
  total_spent: number;
}

export interface Contribution {
  id: number;
  trip_id: number;
  person_id: number;
  person_name: string;
  amount: number;
  date: string;
  note: string | null;
}

export interface Expense {
  id: number;
  trip_id: number;
  category: string;
  description: string;
  amount: number;
  date: string;
  notes: string | null;
  /** Quién pagó con su dinero; null = fondo común. */
  paid_by_person_id: number | null;
  paid_by_name: string | null;
}

export interface ExpenseShare {
  expense_id: number;
  person_id: number;
  person_name: string;
  amount: number;
}

export interface ExpenseWithShares extends Expense {
  shares: ExpenseShare[];
}

export type TransferKind = "loan" | "repayment";

/** budget: préstamos que cubren la parte de un gasto; wallet: préstamos de monto libre entre billeteras. */
export type TransferScope = "budget" | "wallet";

export interface Transfer {
  id: number;
  trip_id: number;
  from_person_id: number;
  from_name: string;
  to_person_id: number;
  to_name: string;
  kind: TransferKind;
  scope: TransferScope;
  amount: number;
  date: string;
  note: string | null;
  /** Gasto cuya parte (del receptor) cubre este préstamo; null = monto libre. */
  expense_id: number | null;
  expense_description: string | null;
}

/** Estado financiero de una persona dentro de un viaje. */
export interface MemberBalance {
  person_id: number;
  name: string;
  /** Suma de aportes (presupuesto actual). */
  budget: number;
  /** Suma de su parte en los gastos. */
  spent: number;
  /** Dinero que entregó a otros (préstamos + devoluciones). */
  transfers_out: number;
  /** Dinero que recibió de otros (préstamos + devoluciones). */
  transfers_in: number;
  /** Partes de otros que esta persona pagó en gastos donde fue el pagador. */
  covered_out: number;
  /** Su parte en gastos que pagó otra persona. */
  covered_in: number;
  /** budget - spent - transfers_out + transfers_in - covered_out + covered_in */
  available: number;
  /** > 0: le debe a otros; < 0: otros le deben. */
  net_debt: number;
}

/** Deuda pendiente entre dos personas: `debtor` le debe `amount` a `creditor`. */
export interface Debt {
  debtor_id: number;
  debtor_name: string;
  creditor_id: number;
  creditor_name: string;
  amount: number;
}

export interface WalletDeposit {
  id: number;
  trip_id: number;
  person_id: number;
  person_name: string;
  amount: number;
  date: string;
  note: string | null;
}

/** Billetera de una persona en un viaje (aparte del presupuesto). */
export interface WalletBalance {
  person_id: number;
  name: string;
  /** Plata que ingresó a su billetera. */
  deposits: number;
  /** Lo que pasó de su billetera al presupuesto (aportes). */
  contributed: number;
  /** Préstamos libres y devoluciones que entregó. */
  given: number;
  /** Préstamos libres y devoluciones que recibió. */
  received: number;
  /** deposits - contributed - given + received */
  balance: number;
  /** > 0: le debe a otros; < 0: otros le deben (solo billetera). */
  net_debt: number;
}

export type ItineraryKind = "flight" | "lodging" | "transport";

/** pending: por reservar; booked: reservado; cancelled: cancelado (no cuenta en alertas). */
export type ItineraryStatus = "pending" | "booked" | "cancelled";

/** Vuelo, hospedaje o transporte del viaje. Fechas 'YYYY-MM-DDTHH:MM' en hora local del lugar. */
export interface ItineraryItem {
  id: number;
  trip_id: number;
  kind: ItineraryKind;
  status: ItineraryStatus;
  /** Aerolínea, nombre del alojamiento o empresa de transporte. */
  provider: string | null;
  /** Nº de vuelo, tipo de habitación o medio de transporte. */
  reference: string | null;
  origin: string | null;
  destination: string | null;
  /** Dirección del alojamiento. */
  address: string | null;
  /** Salida o check-in. */
  start_at: string;
  /** Llegada o check-out. */
  end_at: string | null;
  confirmation_code: string | null;
  notes: string | null;
}

/** Ciudad de la ruta del viaje. Fechas 'YYYY-MM-DD'; las noches van de llegada a salida. */
export interface RouteStop {
  id: number;
  trip_id: number;
  country: string;
  city: string;
  arrival_date: string;
  departure_date: string;
  notes: string | null;
}
