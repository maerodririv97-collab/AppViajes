-- Billetera: la plata que cada persona tiene en el viaje, aparte del presupuesto.
-- Saldo = ingresos - aportes al presupuesto - lo que entrega a otros + lo que recibe de otros
-- (solo movimientos con scope = 'wallet').
CREATE TABLE IF NOT EXISTS wallet_deposits (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id     INTEGER NOT NULL REFERENCES trips(id),
    person_id   INTEGER NOT NULL REFERENCES people(id),
    amount      REAL    NOT NULL,
    date        TEXT    NOT NULL,
    note        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_wallet_deposits_trip ON wallet_deposits(trip_id, person_id);

-- 'budget': préstamos que cubren la parte de un gasto y devoluciones de esas deudas.
-- 'wallet': préstamos de monto libre y sus devoluciones, entre billeteras.
ALTER TABLE transfers ADD COLUMN scope TEXT NOT NULL DEFAULT 'budget'
    CHECK (scope IN ('budget', 'wallet'));

-- Los préstamos de monto libre existentes pasan a la billetera.
UPDATE transfers SET scope = 'wallet' WHERE expense_id IS NULL AND kind = 'loan';
