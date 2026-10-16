-- Itinerario del viaje: vuelos, hospedajes y transportes. El grupo viaja junto, así que
-- cada ítem aplica a todos los integrantes.
-- Fechas como 'YYYY-MM-DDTHH:MM' en hora local del lugar (la que aparece en el tiquete);
-- no se guarda zona horaria, por eso una llegada puede tener hora "anterior" a la salida.
--   flight:    provider = aerolínea, reference = nº de vuelo, origin → destination,
--              start_at = salida, end_at = llegada.
--   lodging:   provider = nombre del alojamiento, address, reference = habitación,
--              start_at = check-in, end_at = check-out.
--   transport: reference = medio (bus, tren...), provider = empresa, origin → destination,
--              start_at = salida, end_at = llegada (opcional).
CREATE TABLE IF NOT EXISTS itinerary_items (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id            INTEGER NOT NULL REFERENCES trips(id),
    kind               TEXT    NOT NULL CHECK (kind IN ('flight', 'lodging', 'transport')),
    status             TEXT    NOT NULL DEFAULT 'booked'
                               CHECK (status IN ('pending', 'booked', 'cancelled')),
    provider           TEXT,
    reference          TEXT,
    origin             TEXT,
    destination        TEXT,
    address            TEXT,
    start_at           TEXT    NOT NULL,
    end_at             TEXT,
    confirmation_code  TEXT,
    notes              TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_itinerary_trip ON itinerary_items(trip_id, start_at);
