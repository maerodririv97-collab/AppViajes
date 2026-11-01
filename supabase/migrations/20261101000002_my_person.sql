-- Vincula cada cuenta con el participante que es dentro de un viaje ("yo soy Katherine").
-- Es por viaje porque el catálogo de personas es de quien lo crea: la misma persona real
-- puede ser filas distintas de people en viajes de dueños distintos.

ALTER TABLE trip_users ADD COLUMN person_id BIGINT REFERENCES people(id) ON DELETE SET NULL;

-- Dos cuentas no pueden ser la misma persona en un viaje.
CREATE UNIQUE INDEX uq_trip_users_person ON trip_users(trip_id, person_id) WHERE person_id IS NOT NULL;

-- trip_users no tiene política de UPDATE: cada cuenta solo cambia su propio vínculo por aquí.
-- p_person_id NULL quita el vínculo.
CREATE FUNCTION set_my_person(p_trip_id BIGINT, p_person_id BIGINT) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT is_trip_user(p_trip_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este viaje';
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

REVOKE EXECUTE ON FUNCTION set_my_person(BIGINT, BIGINT) FROM anon;
