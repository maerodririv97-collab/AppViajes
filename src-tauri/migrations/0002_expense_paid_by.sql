-- Quién pagó el gasto con su dinero. NULL = fondo común (cada quien paga su parte de su presupuesto).
-- Si hay pagador, las partes de los demás cuentan como dinero que él les cubrió (deuda hacia él).
ALTER TABLE expenses ADD COLUMN paid_by_person_id INTEGER REFERENCES people(id);
