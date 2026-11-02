-- Visitantes: cuentas que entran a un viaje con su propio código (viewer_code) y ven todo,
-- pero no pueden modificar nada. Los compañeros siguen entrando con invite_code como editores.
--
-- Las políticas de escritura pasan de is_trip_user (cualquier cuenta del viaje) a
-- can_edit_trip (owner o editor). Los códigos del viaje solo los ven owner y editores: un
-- visitante con el invite_code podría repartir acceso de edición.

-- ---------------------------------------------------------------------------
-- Rol y código
-- ---------------------------------------------------------------------------

ALTER TABLE trip_users DROP CONSTRAINT trip_users_role_check;
ALTER TABLE trip_users ADD CONSTRAINT trip_users_role_check CHECK (role IN ('owner', 'editor', 'viewer'));

-- NULL = no se pueden unir visitantes.
ALTER TABLE trips ADD COLUMN viewer_code TEXT UNIQUE;

CREATE FUNCTION can_edit_trip(p_trip_id BIGINT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM trip_users
        WHERE trip_id = p_trip_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
    );
$$;

-- Persona editable: mía, o integrante de un viaje donde puedo editar.
CREATE FUNCTION can_edit_person(p_person_id BIGINT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM people WHERE id = p_person_id AND owner_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM trip_members tm
            JOIN trip_users tu ON tu.trip_id = tm.trip_id
            WHERE tm.person_id = p_person_id AND tu.user_id = auth.uid() AND tu.role IN ('owner', 'editor')
        );
$$;

-- ---------------------------------------------------------------------------
-- Códigos ocultos a visitantes: sin SELECT directo sobre esas columnas; se leen con get_trip.
-- ---------------------------------------------------------------------------

REVOKE SELECT ON trips FROM authenticated, anon;
GRANT SELECT (id, owner_id, name, destination, start_date, end_date, currency, notes, created_at)
    ON trips TO authenticated;

-- list_trips devolvía invite_code (que ya no puede leer); se recrea sin él.
DROP FUNCTION list_trips();
CREATE FUNCTION list_trips()
RETURNS TABLE (
    id BIGINT, name TEXT, destination TEXT, start_date DATE, end_date DATE, currency TEXT,
    notes TEXT, created_at TIMESTAMPTZ,
    member_count BIGINT, total_budget DOUBLE PRECISION, total_spent DOUBLE PRECISION
)
LANGUAGE sql STABLE AS $$
    SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.currency,
           t.notes, t.created_at,
           (SELECT COUNT(*) FROM trip_members m WHERE m.trip_id = t.id),
           COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.trip_id = t.id), 0),
           COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.trip_id = t.id), 0)
    FROM trips t
    ORDER BY COALESCE(t.start_date, t.created_at::date) DESC, t.id DESC;
$$;

-- Viaje con sus códigos (NULL para visitantes) y el rol de la cuenta actual.
CREATE FUNCTION get_trip(p_trip_id BIGINT)
RETURNS TABLE (
    id BIGINT, name TEXT, destination TEXT, start_date DATE, end_date DATE, currency TEXT,
    notes TEXT, created_at TIMESTAMPTZ,
    invite_code TEXT, viewer_code TEXT, guest_code TEXT, my_role TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT t.id, t.name, t.destination, t.start_date, t.end_date, t.currency,
           t.notes, t.created_at,
           CASE WHEN tu.role <> 'viewer' THEN t.invite_code END,
           CASE WHEN tu.role <> 'viewer' THEN t.viewer_code END,
           CASE WHEN tu.role <> 'viewer' THEN t.guest_code END,
           tu.role
    FROM trips t
    JOIN trip_users tu ON tu.trip_id = t.id AND tu.user_id = auth.uid()
    WHERE t.id = p_trip_id;
$$;

REVOKE EXECUTE ON FUNCTION get_trip(BIGINT) FROM anon;

-- Activa (con código nuevo) o desactiva el código de visitante.
CREATE FUNCTION set_viewer_code(p_trip_id BIGINT, p_enabled BOOLEAN) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF NOT can_edit_trip(p_trip_id) THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar el acceso de este viaje';
    END IF;
    IF p_enabled THEN
        v_code := substr(md5(gen_random_uuid()::text), 1, 8);
    END IF;
    UPDATE trips SET viewer_code = v_code WHERE id = p_trip_id;
    RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_viewer_code(BIGINT, BOOLEAN) FROM anon;

-- invite_code → editor; viewer_code → visitante. Quien ya está no baja de rol; un visitante
-- que recibe el invite_code pasa a editor.
CREATE OR REPLACE FUNCTION join_trip(p_code TEXT) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code TEXT := lower(trim(p_code));
    v_trip_id BIGINT;
    v_role TEXT := 'editor';
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Debes iniciar sesión';
    END IF;
    SELECT id INTO v_trip_id FROM trips WHERE invite_code = v_code;
    IF v_trip_id IS NULL THEN
        SELECT id INTO v_trip_id FROM trips WHERE viewer_code = v_code;
        v_role := 'viewer';
    END IF;
    IF v_trip_id IS NULL THEN
        RAISE EXCEPTION 'Código de invitación no válido';
    END IF;
    INSERT INTO trip_users (trip_id, user_id, role)
    VALUES (v_trip_id, auth.uid(), v_role)
    ON CONFLICT (trip_id, user_id) DO UPDATE
        SET role = CASE WHEN trip_users.role = 'viewer' AND EXCLUDED.role = 'editor'
                        THEN 'editor' ELSE trip_users.role END;
    RETURN v_trip_id;
END;
$$;

-- Solo quien edita puede cambiar el link de invitado o elegir participante.
CREATE OR REPLACE FUNCTION set_guest_code(p_trip_id BIGINT, p_enabled BOOLEAN) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF NOT can_edit_trip(p_trip_id) THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar el acceso de este viaje';
    END IF;
    IF p_enabled THEN
        v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    END IF;
    UPDATE trips SET guest_code = v_code WHERE id = p_trip_id;
    RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION set_my_person(p_trip_id BIGINT, p_person_id BIGINT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT can_edit_trip(p_trip_id) THEN
        RAISE EXCEPTION 'Los visitantes no pueden vincularse a un participante';
    END IF;
    IF p_person_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND person_id = p_person_id
    ) THEN
        RAISE EXCEPTION 'Esa persona no es integrante del viaje';
    END IF;
    UPDATE trip_users SET person_id = p_person_id WHERE trip_id = p_trip_id AND user_id = auth.uid();
EXCEPTION
    WHEN unique_violation THEN
        RAISE EXCEPTION 'Esa persona ya está vinculada a otra cuenta en este viaje';
END;
$$;

-- ---------------------------------------------------------------------------
-- Políticas: leer = cualquier cuenta del viaje; escribir = owner o editor.
-- ---------------------------------------------------------------------------

DROP POLICY trips_update ON trips;
CREATE POLICY trips_update ON trips FOR UPDATE TO authenticated
    USING (can_edit_trip(id));

DROP POLICY people_update ON people;
CREATE POLICY people_update ON people FOR UPDATE TO authenticated
    USING (can_edit_person(id));

DROP POLICY trip_members_insert ON trip_members;
CREATE POLICY trip_members_insert ON trip_members FOR INSERT TO authenticated
    WITH CHECK (can_edit_trip(trip_id) AND can_see_person(person_id));
DROP POLICY trip_members_delete ON trip_members;
CREATE POLICY trip_members_delete ON trip_members FOR DELETE TO authenticated
    USING (can_edit_trip(trip_id));

DROP POLICY contributions_all ON contributions;
CREATE POLICY contributions_select ON contributions FOR SELECT TO authenticated USING (is_trip_user(trip_id));
CREATE POLICY contributions_write ON contributions FOR ALL TO authenticated
    USING (can_edit_trip(trip_id)) WITH CHECK (can_edit_trip(trip_id));

DROP POLICY expenses_all ON expenses;
CREATE POLICY expenses_select ON expenses FOR SELECT TO authenticated USING (is_trip_user(trip_id));
CREATE POLICY expenses_write ON expenses FOR ALL TO authenticated
    USING (can_edit_trip(trip_id)) WITH CHECK (can_edit_trip(trip_id));

DROP POLICY transfers_all ON transfers;
CREATE POLICY transfers_select ON transfers FOR SELECT TO authenticated USING (is_trip_user(trip_id));
CREATE POLICY transfers_write ON transfers FOR ALL TO authenticated
    USING (can_edit_trip(trip_id)) WITH CHECK (can_edit_trip(trip_id));

DROP POLICY wallet_deposits_all ON wallet_deposits;
CREATE POLICY wallet_deposits_select ON wallet_deposits FOR SELECT TO authenticated USING (is_trip_user(trip_id));
CREATE POLICY wallet_deposits_write ON wallet_deposits FOR ALL TO authenticated
    USING (can_edit_trip(trip_id)) WITH CHECK (can_edit_trip(trip_id));

DROP POLICY itinerary_items_all ON itinerary_items;
CREATE POLICY itinerary_items_select ON itinerary_items FOR SELECT TO authenticated USING (is_trip_user(trip_id));
CREATE POLICY itinerary_items_write ON itinerary_items FOR ALL TO authenticated
    USING (can_edit_trip(trip_id)) WITH CHECK (can_edit_trip(trip_id));

DROP POLICY route_stops_all ON route_stops;
CREATE POLICY route_stops_select ON route_stops FOR SELECT TO authenticated USING (is_trip_user(trip_id));
CREATE POLICY route_stops_write ON route_stops FOR ALL TO authenticated
    USING (can_edit_trip(trip_id)) WITH CHECK (can_edit_trip(trip_id));

DROP POLICY expense_shares_all ON expense_shares;
CREATE POLICY expense_shares_select ON expense_shares FOR SELECT TO authenticated
    USING (is_trip_user((SELECT trip_id FROM expenses WHERE id = expense_id)));
CREATE POLICY expense_shares_write ON expense_shares FOR ALL TO authenticated
    USING (can_edit_trip((SELECT trip_id FROM expenses WHERE id = expense_id)))
    WITH CHECK (can_edit_trip((SELECT trip_id FROM expenses WHERE id = expense_id)));

-- El catálogo de Personas es para gestionarlas: solo las que la cuenta puede editar (un
-- visitante sigue viendo los nombres dentro del viaje, vía can_see_person).
CREATE OR REPLACE FUNCTION list_people()
RETURNS TABLE (id BIGINT, name TEXT, phone TEXT, notes TEXT, created_at TIMESTAMPTZ, trip_count BIGINT)
LANGUAGE sql STABLE AS $$
    SELECT p.id, p.name, p.phone, p.notes, p.created_at,
           (SELECT COUNT(*) FROM trip_members m WHERE m.person_id = p.id)
    FROM people p
    WHERE can_edit_person(p.id)
    ORDER BY lower(p.name);
$$;
