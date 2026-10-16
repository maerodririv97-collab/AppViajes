import Database from "@tauri-apps/plugin-sql";

const DB_URL = "sqlite:appviajes.db";

let dbPromise: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_URL);
  return dbPromise;
}
