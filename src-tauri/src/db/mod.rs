// Esquema vía tauri-plugin-sql. Las consultas de lectura/escritura se hacen desde el
// frontend con @tauri-apps/plugin-sql (Database.load/select/execute); este módulo solo
// declara las migraciones y el nombre de la base.
use tauri_plugin_sql::{Migration, MigrationKind};

pub const DB_URL: &str = "sqlite:appviajes.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init: personas, viajes, aportes, gastos, transferencias",
            sql: include_str!("../../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "gastos: pagado por",
            sql: include_str!("../../migrations/0002_expense_paid_by.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "division exacta en partes iguales + prestamos ligados a un gasto",
            sql: include_str!("../../migrations/0003_exact_split_and_loan_expense.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "billetera: ingresos por persona + scope de transferencias",
            sql: include_str!("../../migrations/0004_wallet.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "itinerario: vuelos, hospedajes y transportes",
            sql: include_str!("../../migrations/0005_itinerary.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "ruta: ciudades con fechas de llegada y salida",
            sql: include_str!("../../migrations/0006_route.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
