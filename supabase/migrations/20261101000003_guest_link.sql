-- Link de invitado: acceso de solo lectura, sin cuenta, al itinerario y la ruta de un viaje.
-- Usa un código propio (guest_code), distinto de invite_code (que da acceso de edición), para
-- poder regenerarlo o desactivarlo sin afectar a los compañeros. NULL = link desactivado.

ALTER TABLE trips ADD COLUMN guest_code TEXT UNIQUE;

-- Activa (con un código nuevo) o desactiva el link. 16 caracteres hex = 64 bits: el link es
-- público, así que no debe poder adivinarse probando códigos.
CREATE FUNCTION set_guest_code(p_trip_id BIGINT, p_enabled BOOLEAN) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_code TEXT;
BEGIN
    IF NOT is_trip_user(p_trip_id) THEN
        RAISE EXCEPTION 'No tienes acceso a este viaje';
    END IF;
    IF p_enabled THEN
        v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
    END IF;
    UPDATE trips SET guest_code = v_code WHERE id = p_trip_id;
    RETURN v_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_guest_code(BIGINT, BOOLEAN) FROM anon;

-- Lo que ve un invitado. Sin dinero, sin notas del viaje ni códigos de reserva (con el
-- código y el apellido se puede modificar o cancelar una reserva). NULL si el código no existe.
CREATE FUNCTION guest_trip(p_code TEXT) RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT jsonb_build_object(
        'trip', jsonb_build_object(
            'name', t.name, 'destination', t.destination,
            'start_date', t.start_date, 'end_date', t.end_date
        ),
        'itinerary', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', i.id, 'trip_id', i.trip_id, 'kind', i.kind, 'status', i.status,
                'provider', i.provider, 'reference', i.reference, 'origin', i.origin,
                'destination', i.destination, 'address', i.address, 'start_at', i.start_at,
                'end_at', i.end_at, 'confirmation_code', NULL, 'notes', i.notes
            ) ORDER BY i.start_at, i.id)
            FROM itinerary_items i WHERE i.trip_id = t.id AND i.status <> 'cancelled'
        ), '[]'::jsonb),
        'route', COALESCE((
            SELECT jsonb_agg(to_jsonb(r) - 'created_at' ORDER BY r.arrival_date, r.departure_date, r.id)
            FROM route_stops r WHERE r.trip_id = t.id
        ), '[]'::jsonb)
    )
    FROM trips t
    WHERE p_code IS NOT NULL AND t.guest_code = p_code;
$$;

GRANT EXECUTE ON FUNCTION guest_trip(TEXT) TO anon;
