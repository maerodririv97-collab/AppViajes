-- Funciones que llama src/lib/repo.ts: lecturas con agregados (balances, totales) y
-- escrituras de varias tablas que deben ir en una sola transacción. Todas son SECURITY
-- INVOKER (por defecto), así que las políticas RLS siguen aplicando.

-- ---------------------------------------------------------------------------
-- Ajuste de políticas: al insertar con RETURNING, las funciones STABLE de la política
-- usan la foto de la base anterior a la sentencia y no ven la fila nueva (ni la fila de
-- trip_users que crea el trigger). El dueño debe poder ver su fila directamente.
-- ---------------------------------------------------------------------------

DROP POLICY trips_select ON trips;
CREATE POLICY trips_select ON trips FOR SELECT TO authenticated
    USING (owner_id = auth.uid() OR is_trip_user(id));

DROP POLICY people_select ON people;
CREATE POLICY people_select ON people FOR SELECT TO authenticated
    USING (owner_id = auth.uid() OR can_see_person(id));

-- ---------------------------------------------------------------------------
-- Lecturas
-- ---------------------------------------------------------------------------

CREATE FUNCTION list_people()
RETURNS TABLE (id BIGINT, name TEXT, phone TEXT, notes TEXT, created_at TIMESTAMPTZ, trip_count BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT p.id, p.name, p.phone, p.notes, p.created_at,
           (SELECT COUNT(*) FROM trip_members m WHERE m.person_id = p.id)
    FROM people p
    ORDER BY lower(p.name);
$$;

CREATE FUNCTION list_trips()
RETURNS TABLE (
    id BIGINT, name TEXT, destination TEXT, start_date DATE, end_date DATE, currency TEXT,
    notes TEXT, invite_code TEXT, created_at TIMESTAMPTZ,
    member_count BIGINT, total_budget DOUBLE PRECISION, total_spent DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.currency,
           t.notes, t.invite_code, t.created_at,
           (SELECT COUNT(*) FROM trip_members m WHERE m.trip_id = t.id),
           COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.trip_id = t.id), 0),
           COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.trip_id = t.id), 0)
    FROM trips t
    ORDER BY COALESCE(t.start_date, t.created_at::date) DESC, t.id DESC;
$$;

-- Ver MemberBalance en src/types.ts; available y net_debt se calculan en el cliente.
CREATE FUNCTION trip_balances(p_trip_id BIGINT)
RETURNS TABLE (
    person_id BIGINT, name TEXT, budget DOUBLE PRECISION, spent DOUBLE PRECISION,
    transfers_out DOUBLE PRECISION, transfers_in DOUBLE PRECISION,
    covered_out DOUBLE PRECISION, covered_in DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT p.id, p.name,
       COALESCE((SELECT SUM(c.amount) FROM contributions c
                 WHERE c.trip_id = m.trip_id AND c.person_id = p.id), 0),
       COALESCE((SELECT SUM(s.amount) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                 WHERE e.trip_id = m.trip_id AND s.person_id = p.id), 0),
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'budget'
                   AND t.from_person_id = p.id), 0),
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'budget'
                   AND t.to_person_id = p.id), 0),
       COALESCE((SELECT SUM(s.amount) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                 WHERE e.trip_id = m.trip_id AND e.paid_by_person_id = p.id
                   AND s.person_id <> p.id), 0),
       COALESCE((SELECT SUM(s.amount) FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                 WHERE e.trip_id = m.trip_id AND s.person_id = p.id
                   AND e.paid_by_person_id IS NOT NULL AND e.paid_by_person_id <> p.id), 0)
    FROM trip_members m JOIN people p ON p.id = m.person_id
    WHERE m.trip_id = p_trip_id
    ORDER BY lower(p.name);
$$;

-- Ver WalletBalance en src/types.ts; balance y net_debt se calculan en el cliente.
CREATE FUNCTION wallet_balances(p_trip_id BIGINT)
RETURNS TABLE (
    person_id BIGINT, name TEXT, deposits DOUBLE PRECISION, contributed DOUBLE PRECISION,
    given DOUBLE PRECISION, received DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT p.id, p.name,
       COALESCE((SELECT SUM(w.amount) FROM wallet_deposits w
                 WHERE w.trip_id = m.trip_id AND w.person_id = p.id), 0),
       COALESCE((SELECT SUM(c.amount) FROM contributions c
                 WHERE c.trip_id = m.trip_id AND c.person_id = p.id), 0),
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'wallet'
                   AND t.from_person_id = p.id), 0),
       COALESCE((SELECT SUM(t.amount) FROM transfers t
                 WHERE t.trip_id = m.trip_id AND t.scope = 'wallet'
                   AND t.to_person_id = p.id), 0)
    FROM trip_members m JOIN people p ON p.id = m.person_id
    WHERE m.trip_id = p_trip_id
    ORDER BY lower(p.name);
$$;

-- ---------------------------------------------------------------------------
-- Escrituras
-- ---------------------------------------------------------------------------

-- Crea (p_expense_id NULL) o actualiza un gasto junto con sus partes.
-- p_shares: [{"person_id": 1, "amount": 1000.5}, ...]. Devuelve el id del gasto.
CREATE FUNCTION save_expense(
    p_trip_id BIGINT, p_expense_id BIGINT, p_category TEXT, p_description TEXT,
    p_amount DOUBLE PRECISION, p_date DATE, p_notes TEXT, p_paid_by BIGINT, p_shares JSONB
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    v_id BIGINT := p_expense_id;
BEGIN
    IF v_id IS NULL THEN
        INSERT INTO expenses (trip_id, category, description, amount, date, notes, paid_by_person_id)
        VALUES (p_trip_id, p_category, p_description, p_amount, p_date, p_notes, p_paid_by)
        RETURNING id INTO v_id;
    ELSE
        UPDATE expenses SET category = p_category, description = p_description, amount = p_amount,
            date = p_date, notes = p_notes, paid_by_person_id = p_paid_by
        WHERE id = v_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Gasto no encontrado';
        END IF;
        DELETE FROM expense_shares WHERE expense_id = v_id;
    END IF;

    INSERT INTO expense_shares (expense_id, person_id, amount)
    SELECT v_id, x.person_id, x.amount
    FROM jsonb_to_recordset(p_shares) AS x(person_id BIGINT, amount DOUBLE PRECISION);

    -- Los préstamos que cubren este gasto siguen la nueva parte del deudor; si ya no
    -- participa, el préstamo se conserva como monto libre.
    UPDATE transfers t SET amount = s.amount
    FROM expense_shares s
    WHERE t.expense_id = v_id AND s.expense_id = v_id AND s.person_id = t.to_person_id;

    UPDATE transfers t SET expense_id = NULL
    WHERE t.expense_id = v_id AND NOT EXISTS (
        SELECT 1 FROM expense_shares s WHERE s.expense_id = v_id AND s.person_id = t.to_person_id
    );

    RETURN v_id;
END;
$$;

CREATE FUNCTION remove_trip_member(p_trip_id BIGINT, p_person_id BIGINT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM contributions WHERE trip_id = p_trip_id AND person_id = p_person_id)
       OR EXISTS (SELECT 1 FROM expense_shares s JOIN expenses e ON e.id = s.expense_id
                  WHERE e.trip_id = p_trip_id AND s.person_id = p_person_id)
       OR EXISTS (SELECT 1 FROM transfers WHERE trip_id = p_trip_id
                  AND (from_person_id = p_person_id OR to_person_id = p_person_id))
       OR EXISTS (SELECT 1 FROM expenses WHERE trip_id = p_trip_id AND paid_by_person_id = p_person_id)
       OR EXISTS (SELECT 1 FROM wallet_deposits WHERE trip_id = p_trip_id AND person_id = p_person_id)
    THEN
        RAISE EXCEPTION 'La persona tiene movimientos de billetera, aportes, gastos o préstamos en este viaje. Elimina esos movimientos antes de quitarla.';
    END IF;
    DELETE FROM trip_members WHERE trip_id = p_trip_id AND person_id = p_person_id;
END;
$$;
