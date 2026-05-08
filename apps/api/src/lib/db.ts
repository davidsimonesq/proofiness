// SQLite-backed dossier persistence. Per spec §5: SQLite is acceptable for
// single-user dev. Stores completed dossiers as JSON blobs keyed by id, plus
// indexed columns (claim, created_at) for the history list and denormalized
// columns (subclaim_count, has_crux) for cheap filtering without parsing each blob.

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Dossier, DossierSummary } from "@proofiness/shared-types";

const DB_PATH = process.env.PROOFINESS_DB_PATH ?? "./data/proofiness.db";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  _db = db;
  return db;
}

// ─── Migration system ────────────────────────────────────────────────────────
// Append-only list of numbered migrations. Each runs once, in order, the first
// time the db is opened after the migration is added. Re-runs against an
// already-migrated db are no-ops.
//
// To add a migration: append a new entry with the next version number. Don't
// renumber existing migrations and don't edit them in place once they've been
// shipped — write a new migration that adjusts whatever needs adjusting.

interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS dossiers (
          id          TEXT PRIMARY KEY,
          claim       TEXT NOT NULL,
          created_at  TEXT NOT NULL,
          body        TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dossiers_created_at ON dossiers(created_at DESC);
      `);
    },
  },
  {
    version: 2,
    up: (db) => {
      // Denormalized columns for cheap filtering without parsing the body blob.
      // Backfill from existing rows in the same migration.
      db.exec(`
        ALTER TABLE dossiers ADD COLUMN subclaim_count INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE dossiers ADD COLUMN has_crux       INTEGER NOT NULL DEFAULT 0;
      `);
      const rows = db.prepare("SELECT id, body FROM dossiers").all() as Array<{
        id: string;
        body: string;
      }>;
      const update = db.prepare(
        "UPDATE dossiers SET subclaim_count = ?, has_crux = ? WHERE id = ?",
      );
      for (const row of rows) {
        try {
          const parsed = JSON.parse(row.body) as Partial<Dossier>;
          const sc = Array.isArray(parsed.subClaims) ? parsed.subClaims.length : 0;
          const hc = parsed.crux ? 1 : 0;
          update.run(sc, hc, row.id);
        } catch {
          // Bad row data — leave defaults.
        }
      }
    },
  },
];

function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);
  const row = db.prepare("SELECT MAX(version) AS v FROM schema_version").get() as { v: number | null };
  const current = row.v ?? 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    const tx = db.transaction(() => {
      m.up(db);
      db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(
        m.version,
        new Date().toISOString(),
      );
    });
    try {
      tx();
      console.log(`[db] applied migration v${m.version}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`[db] migration v${m.version} failed: ${msg}`);
    }
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function saveDossier(d: Dossier): void {
  const db = getDb();
  db.prepare(
    `INSERT OR REPLACE INTO dossiers (id, claim, created_at, body, subclaim_count, has_crux)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    d.id,
    d.claim,
    d.createdAt,
    JSON.stringify(d),
    d.subClaims.length,
    d.crux ? 1 : 0,
  );
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

export interface ListCursor {
  createdAt: string;
  id: string;
}

export interface ListPage {
  rows: DossierSummary[];
  nextCursor: ListCursor | null;
}

// Cursor-paginated list ordered by (created_at DESC, id DESC). The id tiebreaker
// guarantees deterministic ordering even when multiple dossiers share a
// timestamp (unlikely but possible). Caller passes back the previous page's
// nextCursor to fetch subsequent pages.
export function listDossiers(opts: { limit?: number; cursor?: ListCursor | null } = {}): ListPage {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  // Fetch one extra row to detect whether more data exists without a separate count.
  const fetchLimit = limit + 1;

  let rows: DossierSummary[];
  if (opts.cursor) {
    rows = db
      .prepare(
        `SELECT id, claim, created_at AS createdAt FROM dossiers
         WHERE created_at < ? OR (created_at = ? AND id < ?)
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(opts.cursor.createdAt, opts.cursor.createdAt, opts.cursor.id, fetchLimit) as DossierSummary[];
  } else {
    rows = db
      .prepare(
        `SELECT id, claim, created_at AS createdAt FROM dossiers
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(fetchLimit) as DossierSummary[];
  }

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  const nextCursor: ListCursor | null = hasMore && last ? { createdAt: last.createdAt, id: last.id } : null;
  return { rows: page, nextCursor };
}

export function deleteDossier(id: string): boolean {
  const db = getDb();
  const result = db.prepare(`DELETE FROM dossiers WHERE id = ?`).run(id);
  return result.changes > 0;
}
