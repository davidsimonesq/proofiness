// SQLite-backed dossier persistence. Per spec §5: SQLite is acceptable for
// single-user dev. Stores completed dossiers as JSON blobs keyed by id, plus
// indexed columns (claim, created_at) for the history list.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Dossier, DossierSummary } from "@crux/shared-types";

const DB_PATH = process.env.CRUX_DB_PATH ?? "./data/crux.db";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS dossiers (
      id          TEXT PRIMARY KEY,
      claim       TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      body        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_dossiers_created_at ON dossiers(created_at DESC);
  `);
  _db = db;
  return db;
}

export function saveDossier(d: Dossier): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO dossiers (id, claim, created_at, body) VALUES (?, ?, ?, ?)`,
  ).run(d.id, d.claim, d.createdAt, JSON.stringify(d));
}

export function getDossier(id: string): Dossier | null {
  const db = getDb();
  const row = db.prepare(`SELECT body FROM dossiers WHERE id = ?`).get(id) as
    | { body: string }
    | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.body) as Dossier;
  } catch {
    return null;
  }
}

export function listDossiers(limit = 100): DossierSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, claim, created_at AS createdAt FROM dossiers ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as DossierSummary[];
  return rows;
}

export function deleteDossier(id: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM dossiers WHERE id = ?`).run(id);
  return result.changes > 0;
}
