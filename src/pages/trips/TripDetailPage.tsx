import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "../../components/layout/Layout";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useMutation } from "../../hooks/useMutation";
import { useQuery } from "../../hooks/useQuery";
import { formatDate } from "../../lib/format";
import {
  computeDebts,
  deleteTrip,
  getBalances,
  getTrip,
  getWalletBalances,
  listContributions,
  listExpenses,
  listItinerary,
  listRouteStops,
  listMembers,
  listTransfers,
  listWalletDeposits,
} from "../../lib/repo";
import { TripFormModal } from "./TripFormModal";
import { SummaryTab } from "./tabs/SummaryTab";
import { ItineraryTab } from "./tabs/ItineraryTab";
import { ExpensesTab } from "./tabs/ExpensesTab";
import { BudgetTab } from "./tabs/BudgetTab";
import { TransfersTab } from "./tabs/TransfersTab";
import { WalletTab } from "./tabs/WalletTab";
import { MembersTab } from "./tabs/MembersTab";
import type { TripData } from "./tripData";

const TABS = [
  { key: "summary", label: "Resumen" },
  { key: "itinerary", label: "Itinerario" },
  { key: "expenses", label: "Gastos" },
  { key: "budget", label: "Presupuesto" },
  { key: "transfers", label: "Préstamos de gastos" },
  { key: "wallet", label: "Billetera" },
  { key: "members", label: "Integrantes" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

async function loadTripData(id: number): Promise<TripData | null> {
  const trip = await getTrip(id);
  if (!trip) return null;
  const [members, balances, contributions, expenses, allTransfers, deposits, walletBalances, itinerary, route] =
    await Promise.all([
      listMembers(id),
      getBalances(id),
      listContributions(id),
      listExpenses(id),
      listTransfers(id),
      listWalletDeposits(id),
      getWalletBalances(id),
      listItinerary(id),
      listRouteStops(id),
    ]);
  const transfers = allTransfers.filter((t) => t.scope === "budget");
  const walletTransfers = allTransfers.filter((t) => t.scope === "wallet");
  return {
    trip,
    members,
    balances,
    contributions,
    expenses,
    transfers,
    debts: computeDebts(transfers, expenses, trip.currency),
    deposits,
    walletBalances,
    walletTransfers,
    walletDebts: computeDebts(walletTransfers, [], trip.currency),
    itinerary,
    route,
  };
}

export function TripDetailPage() {
  const tripId = Number(useParams().id);
  const { data, loading } = useQuery(() => loadTripData(tripId), [tripId]);
  const [tab, setTab] = useState<TabKey>("summary");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const del = useMutation();
  const navigate = useNavigate();

  if (!data) {
    return loading ? null : (
      <div className="text-slate-500">
        Viaje no encontrado.{" "}
        <Link to="/" className="text-teal-600 underline">
          Volver
        </Link>
      </div>
    );
  }

  const { trip } = data;

  return (
    <>
      <Link to="/" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-teal-600">
        <ArrowLeft size={15} /> Viajes
      </Link>
      <PageHeader
        title={trip.name}
        subtitle={
          <div className="flex flex-wrap gap-x-4 gap-y-1">
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
            <span>Moneda: {trip.currency}</span>
          </div>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={15} /> Editar
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                del.setError(null);
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={15} />
            </Button>
          </>
        }
      />

      <div className="mb-6 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-teal-600 text-teal-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "summary" && <SummaryTab data={data} />}
      {tab === "itinerary" && <ItineraryTab data={data} />}
      {tab === "expenses" && <ExpensesTab data={data} />}
      {tab === "budget" && <BudgetTab data={data} />}
      {tab === "transfers" && <TransfersTab data={data} />}
      {tab === "wallet" && <WalletTab data={data} />}
      {tab === "members" && <MembersTab data={data} />}

      <TripFormModal open={editOpen} trip={trip} onClose={() => setEditOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar viaje"
        message={`Se eliminará "${trip.name}" con todos sus aportes, gastos, préstamos, itinerario y ruta. Esta acción no se puede deshacer.`}
        busy={del.busy}
        error={del.error}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          if (await del.run(() => deleteTrip(trip.id))) navigate("/");
        }}
      />
    </>
  );
}
