-- Ruta del viaje: ciudades por las que pasa el grupo, con fechas de llegada y salida.
-- Los hospedajes y transportes del itinerario se cruzan con la ruta por fechas (no por
-- nombre de ciudad) para ver qué noches y qué traslados faltan.
CREATE TABLE IF NOT EXISTS route_stops (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id         INTEGER NOT NULL REFERENCES trips(id),
    country         TEXT    NOT NULL,
    city            TEXT    NOT NULL,
    arrival_date    TEXT    NOT NULL,
    departure_date  TEXT    NOT NULL,
    notes           TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    CHECK (departure_date >= arrival_date)
);

CREATE INDEX IF NOT EXISTS idx_route_trip ON route_stops(trip_id, arrival_date);
