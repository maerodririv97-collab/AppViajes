import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, KeyRound, MapPin, Plane, Plus, Users } from "lucide-react";
import { PageHeader } from "../../components/layout/Layout";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Money } from "../../components/ui/Money";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { useQuery } from "../../hooks/useQuery";
import { formatDate } from "../../lib/format";
import { listTrips } from "../../lib/repo";
import { TripFormModal } from "./TripFormModal";
import { JoinTripModal } from "./JoinTripModal";

export function TripsPage() {
  const { data: trips = [], loading } = useQuery(listTrips, []);
  const [formOpen, setFormOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Viajes"
        subtitle="Presupuesto, gastos y préstamos de cada viaje."
        actions={
          <>
            <Button variant="secondary" onClick={() => setJoinOpen(true)}>
              <KeyRound size={16} /> Unirme con código
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus size={16} /> Nuevo viaje
            </Button>
          </>
        }
      />

      {!loading && trips.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Aún no hay viajes"
          description="Crea tu primer viaje, o únete al de un compañero con su código de invitación."
          action={<Button onClick={() => setFormOpen(true)}>Crear viaje</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trips.map((t) => {
            const available = t.total_budget - t.total_spent;
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/viajes/${t.id}`)}
                className="card p-5 text-left transition-shadow hover:shadow-md"
              >
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t.name}</h3>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    {t.destination && (
                      <span className="flex items-center gap-1">
                        <MapPin size={13} /> {t.destination}
                      </span>
                    )}
                    {(t.start_date || t.end_date) && (
                      <span className="flex items-center gap-1">
                        <CalendarDays size={13} /> {formatDate(t.start_date)} – {formatDate(t.end_date)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users size={13} /> {t.member_count}
                    </span>
                  </div>
                </div>
                <ProgressBar used={t.total_spent} total={t.total_budget} />
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-slate-500">Presupuesto</div>
                    <Money value={t.total_budget} currency={t.currency} className="font-medium" />
                  </div>
                  <div>
                    <div className="text-slate-500">Gastado</div>
                    <Money value={t.total_spent} currency={t.currency} className="font-medium" />
                  </div>
                  <div>
                    <div className="text-slate-500">Disponible</div>
                    <Money value={available} currency={t.currency} signed className="font-medium" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <TripFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => navigate(`/viajes/${id}`)}
      />
      <JoinTripModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(id) => navigate(`/viajes/${id}`)}
      />
    </>
  );
}
