import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { TripsPage } from "./pages/trips/TripsPage";
import { TripDetailPage } from "./pages/trips/TripDetailPage";
import { PeoplePage } from "./pages/people/PeoplePage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<TripsPage />} />
          <Route path="viajes/:id" element={<TripDetailPage />} />
          <Route path="personas" element={<PeoplePage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
