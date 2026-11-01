import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthGate } from "./components/auth/AuthGate";
import { Layout } from "./components/layout/Layout";
import { TripsPage } from "./pages/trips/TripsPage";
import { TripDetailPage } from "./pages/trips/TripDetailPage";
import { PeoplePage } from "./pages/people/PeoplePage";
import { GuestTripPage } from "./pages/guest/GuestTripPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Link de invitado: público, sin sesión. */}
        <Route path="invitado/:code" element={<GuestTripPage />} />
        <Route
          element={
            <AuthGate>
              <Layout />
            </AuthGate>
          }
        >
          <Route index element={<TripsPage />} />
          <Route path="viajes/:id" element={<TripDetailPage />} />
          <Route path="personas" element={<PeoplePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
