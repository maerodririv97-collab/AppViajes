-- Personas: catálogo global, se asignan a cada viaje vía trip_members.
CREATE TABLE IF NOT EXISTS people (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    phone       TEXT,
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS trips (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    destination TEXT,
    start_date  TEXT,
    end_date    TEXT,
    currency    TEXT    NOT NULL DEFAULT 'COP',
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS trip_members (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id     INTEGER NOT NULL REFERENCES trips(id),
    person_id   INTEGER NOT NULL REFERENCES people(id),
    UNIQUE (trip_id, person_id)
);

-- Presupuesto = SUM(amount) de los aportes de la persona en el viaje.
-- Un ajuste a la baja se guarda como aporte negativo para no perder historial.
CREATE TABLE IF NOT EXISTS contributions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id     INTEGER NOT NULL REFERENCES trips(id),
    person_id   INTEGER NOT NULL REFERENCES people(id),
    amount      REAL    NOT NULL,
    date        TEXT    NOT NULL,
    note        TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS expenses (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id     INTEGER NOT NULL REFERENCES trips(id),
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    amount      REAL    NOT NULL CHECK (amount > 0),
    date        TEXT    NOT NULL,
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Parte que le toca a cada persona de un gasto (se descuenta de su disponible).
CREATE TABLE IF NOT EXISTS expense_shares (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id  INTEGER NOT NULL REFERENCES expenses(id),
    person_id   INTEGER NOT NULL REFERENCES people(id),
    amount      REAL    NOT NULL,
    UNIQUE (expense_id, person_id)
);

-- Movimientos de dinero entre personas: 'loan' = préstamo, 'repayment' = devolución.
-- Ambos restan disponible a from_person y lo suman a to_person.
CREATE TABLE IF NOT EXISTS transfers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id         INTEGER NOT NULL REFERENCES trips(id),
    from_person_id  INTEGER NOT NULL REFERENCES people(id),
    to_person_id    INTEGER NOT NULL REFERENCES people(id),
    kind            TEXT    NOT NULL CHECK (kind IN ('loan', 'repayment')),
    amount          REAL    NOT NULL CHECK (amount > 0),
    date            TEXT    NOT NULL,
    note            TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    CHECK (from_person_id <> to_person_id)
);

CREATE INDEX IF NOT EXISTS idx_members_trip       ON trip_members(trip_id);
CREATE INDEX IF NOT EXISTS idx_contributions_trip ON contributions(trip_id, person_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip      ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_shares_expense     ON expense_shares(expense_id);
CREATE INDEX IF NOT EXISTS idx_shares_person      ON expense_shares(person_id);
CREATE INDEX IF NOT EXISTS idx_transfers_trip     ON transfers(trip_id);
