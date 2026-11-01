-- Esquema de AppViajes en Supabase (Postgres). Equivale a las migraciones SQLite
-- 0001..0006 de src-tauri/migrations, más el acceso compartido por usuario.
--
-- Acceso: cada viaje tiene usuarios (trip_users). Quien crea el viaje queda como 'owner';
-- los compañeros entran con el código de invitación del viaje (join_trip) como 'editor'.
-- Todas las tablas hijas se filtran por pertenencia al viaje con RLS.

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Personas: catálogo del usuario que las crea; se asignan a cada viaje vía trip_members.
-- Los demás usuarios del viaje también las ven (y editan) mientras estén en ese viaje.
CREATE TABLE people (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id    UUID    NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    phone       TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE trips (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id    UUID    NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    destination TEXT,
    start_date  DATE,
    end_date    DATE,
    currency    TEXT    NOT NULL DEFAULT 'COP',
    notes       TEXT,
    invite_code TEXT    NOT NULL UNIQUE DEFAULT substr(md5(gen_random_uuid()::text), 1, 8),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usuarios (cuentas) con acceso a un viaje. No confundir con trip_members (personas del viaje).
CREATE TABLE trip_users (
    trip_id     BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id     UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id)
);

CREATE TABLE trip_members (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id     BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    person_id   BIGINT  NOT NULL REFERENCES people(id),
    UNIQUE (trip_id, person_id)
);

-- Presupuesto = SUM(amount) de los aportes de la persona en el viaje.
-- Un ajuste a la baja se guarda como aporte negativo para no perder historial.
CREATE TABLE contributions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id     BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    person_id   BIGINT  NOT NULL REFERENCES people(id),
    amount      DOUBLE PRECISION NOT NULL,
    date        DATE    NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- paid_by_person_id: quién pagó con su dinero. NULL = fondo común (cada quien paga su parte
-- de su presupuesto). Si hay pagador, las partes de los demás son deuda hacia él.
CREATE TABLE expenses (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id            BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    category           TEXT    NOT NULL,
    description        TEXT    NOT NULL,
    amount             DOUBLE PRECISION NOT NULL CHECK (amount > 0),
    date               DATE    NOT NULL,
    notes              TEXT,
    paid_by_person_id  BIGINT  REFERENCES people(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Parte que le toca a cada persona de un gasto (se descuenta de su disponible).
-- En partes iguales se guarda la parte exacta (total / n), sin redondear.
CREATE TABLE expense_shares (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_id  BIGINT  NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    person_id   BIGINT  NOT NULL REFERENCES people(id),
    amount      DOUBLE PRECISION NOT NULL,
    UNIQUE (expense_id, person_id)
);

-- Movimientos de dinero entre personas: 'loan' = préstamo, 'repayment' = devolución.
-- Ambos restan disponible a from_person y lo suman a to_person.
-- scope 'budget': préstamos que cubren la parte de un gasto (expense_id) y sus devoluciones.
-- scope 'wallet': préstamos de monto libre y sus devoluciones, entre billeteras.
CREATE TABLE transfers (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id         BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    from_person_id  BIGINT  NOT NULL REFERENCES people(id),
    to_person_id    BIGINT  NOT NULL REFERENCES people(id),
    kind            TEXT    NOT NULL CHECK (kind IN ('loan', 'repayment')),
    amount          DOUBLE PRECISION NOT NULL CHECK (amount > 0),
    date            DATE    NOT NULL,
    note            TEXT,
    expense_id      BIGINT  REFERENCES expenses(id) ON DELETE CASCADE,
    scope           TEXT    NOT NULL DEFAULT 'budget' CHECK (scope IN ('budget', 'wallet')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (from_person_id <> to_person_id)
);

-- Billetera: la plata que cada persona tiene en el viaje, aparte del presupuesto.
-- Saldo = ingresos - aportes al presupuesto - lo que entrega a otros + lo que recibe de otros
-- (solo movimientos con scope = 'wallet').
CREATE TABLE wallet_deposits (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id     BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    person_id   BIGINT  NOT NULL REFERENCES people(id),
    amount      DOUBLE PRECISION NOT NULL,
    date        DATE    NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Itinerario: vuelos, hospedajes y transportes; cada ítem aplica a todo el grupo.
-- start_at/end_at como texto 'YYYY-MM-DDTHH:MM' en hora local del lugar (la del tiquete), sin
-- zona horaria; por eso una llegada puede tener hora "anterior" a la salida.
CREATE TABLE itinerary_items (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id            BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
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
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ruta: ciudades por las que pasa el grupo. Se cruza con el itinerario por fechas.
CREATE TABLE route_stops (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id         BIGINT  NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    country         TEXT    NOT NULL,
    city            TEXT    NOT NULL,
    arrival_date    DATE    NOT NULL,
    departure_date  DATE    NOT NULL,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (departure_date >= arrival_date)
);

CREATE INDEX idx_people_owner             ON people(owner_id);
CREATE INDEX idx_trip_users_user          ON trip_users(user_id);
CREATE INDEX idx_members_trip             ON trip_members(trip_id);
CREATE INDEX idx_members_person           ON trip_members(person_id);
CREATE INDEX idx_contributions_trip       ON contributions(trip_id, person_id);
CREATE INDEX idx_expenses_trip            ON expenses(trip_id);
CREATE INDEX idx_shares_expense           ON expense_shares(expense_id);
CREATE INDEX idx_shares_person            ON expense_shares(person_id);
CREATE INDEX idx_transfers_trip           ON transfers(trip_id);
CREATE INDEX idx_transfers_expense        ON transfers(expense_id);
CREATE INDEX idx_wallet_deposits_trip     ON wallet_deposits(trip_id, person_id);
CREATE INDEX idx_itinerary_trip           ON itinerary_items(trip_id, start_at);
CREATE INDEX idx_route_trip               ON route_stops(trip_id, arrival_date);

-- ---------------------------------------------------------------------------
-- Acceso
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER para que las políticas puedan consultar trip_users sin recursión de RLS.
CREATE FUNCTION is_trip_user(p_trip_id BIGINT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM trip_users WHERE trip_id = p_trip_id AND user_id = auth.uid()
    );
$$;

CREATE FUNCTION is_trip_owner(p_trip_id BIGINT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM trip_users
        WHERE trip_id = p_trip_id AND user_id = auth.uid() AND role = 'owner'
    );
$$;

-- Una persona es visible si es mía o está en algún viaje al que tengo acceso.
CREATE FUNCTION can_see_person(p_person_id BIGINT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM people WHERE id = p_person_id AND owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM trip_members tm
            JOIN trip_users tu ON tu.trip_id = tm.trip_id
            WHERE tm.person_id = p_person_id AND tu.user_id = auth.uid()
        );
$$;

-- Quien crea un viaje queda como owner.
CREATE FUNCTION add_trip_owner() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO trip_users (trip_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_trips_owner AFTER INSERT ON trips
    FOR EACH ROW EXECUTE FUNCTION add_trip_owner();

-- Unirse a un viaje con su código de invitación. Devuelve el id del viaje.
CREATE FUNCTION join_trip(p_code TEXT) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_trip_id BIGINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;
    SELECT id INTO v_trip_id FROM trips WHERE invite_code = lower(trim(p_code));
    IF v_trip_id IS NULL THEN
        RAISE EXCEPTION 'Código de invitación no válido';
    END IF;
    INSERT INTO trip_users (trip_id, user_id, role)
    VALUES (v_trip_id, auth.uid(), 'editor')
    ON CONFLICT (trip_id, user_id) DO NOTHING;
    RETURN v_trip_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION join_trip(TEXT) FROM anon;

ALTER TABLE people          ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips           ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_shares  ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops     ENABLE ROW LEVEL SECURITY;

-- people
CREATE POLICY people_select ON people FOR SELECT TO authenticated
    USING (can_see_person(id));
CREATE POLICY people_insert ON people FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());
CREATE POLICY people_update ON people FOR UPDATE TO authenticated
    USING (can_see_person(id));
CREATE POLICY people_delete ON people FOR DELETE TO authenticated
    USING (owner_id = auth.uid());

-- trips
CREATE POLICY trips_select ON trips FOR SELECT TO authenticated
    USING (is_trip_user(id));
CREATE POLICY trips_insert ON trips FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());
CREATE POLICY trips_update ON trips FOR UPDATE TO authenticated
    USING (is_trip_user(id));
CREATE POLICY trips_delete ON trips FOR DELETE TO authenticated
    USING (is_trip_owner(id));

-- trip_users: se ven los compañeros del viaje; el owner puede sacar a alguien
-- y cada uno puede salirse. Las altas van por el trigger o por join_trip.
CREATE POLICY trip_users_select ON trip_users FOR SELECT TO authenticated
    USING (is_trip_user(trip_id));
CREATE POLICY trip_users_delete ON trip_users FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR is_trip_owner(trip_id));

-- trip_members: además de acceso al viaje, la persona debe ser visible para quien la agrega.
CREATE POLICY trip_members_select ON trip_members FOR SELECT TO authenticated
    USING (is_trip_user(trip_id));
CREATE POLICY trip_members_insert ON trip_members FOR INSERT TO authenticated
    WITH CHECK (is_trip_user(trip_id) AND can_see_person(person_id));
CREATE POLICY trip_members_delete ON trip_members FOR DELETE TO authenticated
    USING (is_trip_user(trip_id));

-- Tablas hijas con trip_id: acceso completo para los usuarios del viaje.
CREATE POLICY contributions_all ON contributions FOR ALL TO authenticated
    USING (is_trip_user(trip_id)) WITH CHECK (is_trip_user(trip_id));
CREATE POLICY expenses_all ON expenses FOR ALL TO authenticated
    USING (is_trip_user(trip_id)) WITH CHECK (is_trip_user(trip_id));
CREATE POLICY transfers_all ON transfers FOR ALL TO authenticated
    USING (is_trip_user(trip_id)) WITH CHECK (is_trip_user(trip_id));
CREATE POLICY wallet_deposits_all ON wallet_deposits FOR ALL TO authenticated
    USING (is_trip_user(trip_id)) WITH CHECK (is_trip_user(trip_id));
CREATE POLICY itinerary_items_all ON itinerary_items FOR ALL TO authenticated
    USING (is_trip_user(trip_id)) WITH CHECK (is_trip_user(trip_id));
CREATE POLICY route_stops_all ON route_stops FOR ALL TO authenticated
    USING (is_trip_user(trip_id)) WITH CHECK (is_trip_user(trip_id));

-- expense_shares: a través del viaje del gasto.
CREATE POLICY expense_shares_all ON expense_shares FOR ALL TO authenticated
    USING (is_trip_user((SELECT trip_id FROM expenses WHERE id = expense_id)))
    WITH CHECK (is_trip_user((SELECT trip_id FROM expenses WHERE id = expense_id)));
