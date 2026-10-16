-- 1) Préstamos ligados a un gasto: el prestamista cubre la parte del deudor en ese gasto.
ALTER TABLE transfers ADD COLUMN expense_id INTEGER REFERENCES expenses(id);
CREATE INDEX IF NOT EXISTS idx_transfers_expense ON transfers(expense_id);

-- 2) Las divisiones en partes iguales se guardaban redondeadas a la unidad mínima de la moneda
--    y el residuo quedaba en una persona (ej. 300.001 / 300.000 / 300.000). Ahora se guarda la
--    parte exacta (total / n) para todos. Solo se tocan gastos cuya diferencia entre partes es de
--    una unidad mínima o menos, es decir, los que eran partes iguales con residuo.
UPDATE expense_shares
SET amount = (
    SELECT e.amount / (SELECT COUNT(*) FROM expense_shares s2 WHERE s2.expense_id = e.id)
    FROM expenses e WHERE e.id = expense_shares.expense_id
)
WHERE expense_id IN (
    SELECT s.expense_id
    FROM expense_shares s
    JOIN expenses e ON e.id = s.expense_id
    JOIN trips t ON t.id = e.trip_id
    GROUP BY s.expense_id
    HAVING MAX(s.amount) <> MIN(s.amount)
       AND MAX(s.amount) - MIN(s.amount)
           <= (CASE WHEN t.currency IN ('COP', 'CLP') THEN 1 ELSE 0.01 END) + 0.000001
);
