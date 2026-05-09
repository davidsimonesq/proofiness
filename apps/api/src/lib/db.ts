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
  {
    version: 3,
    up: (db) => {
      // Per-invite-code daily usage counter for the cost gate. Composite primary
      // key on (code, day) so each (code, YYYY-MM-DD) gets one row that
      // INCREMENT-on-conflict bumps. Cleanup is intentionally not automated —
      // rows are tiny and let you audit usage history.
      db.exec(`
        CREATE TABLE IF NOT EXISTS invite_usage (
          code  TEXT NOT NULL,
          day   TEXT NOT NULL,
          count INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (code, day)
        );
        CREATE INDEX IF NOT EXISTS idx_invite_usage_day ON invite_usage(day);
      `);
    },
  },
  {
    version: 4,
    up: (db) => {
      // Source of truth for accepted invite codes. Pre-v4, the only source was
      // INVITE_CODES (env var) read on each request — adding a code required
      // a redeploy. This table lets the auto-mint endpoint add codes at
      // runtime, while preserving the env-var workflow as a startup seed
      // (see seedInviteCodesFromEnv below).
      //
      // source: 'env' (seeded from INVITE_CODES) | 'auto' (Claude-approved
      // self-service mint) | 'manual' (admin CLI).
      // request_ip: only set for source='auto'; nulled for env/manual.
      // revoked_at: soft-revoke; non-null means the code is no longer accepted.
      db.exec(`
        CREATE TABLE IF NOT EXISTS invite_codes (
          code        TEXT PRIMARY KEY,
          source      TEXT NOT NULL,
          created_at  TEXT NOT NULL,
          request_ip  TEXT,
          revoked_at  TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_invite_codes_created_at ON invite_codes(created_at);
        CREATE INDEX IF NOT EXISTS idx_invite_codes_source_ip   ON invite_codes(source, request_ip);
      `);
    },
  },
  {
    version: 5,
    up: (db) => {
      // Per-instance sequential dossier number — stable user-facing identifier.
      // First dossier ever = #1, then increments. Surfaced in the dossier
      // header and the history list so they match (no more position-in-list
      // confusion that drifts as new dossiers are created).
      //
      // SQLite quirk: can't add a UNIQUE column directly to a populated table.
      // Workaround: add as nullable INTEGER, backfill in created_at order,
      // then create the unique index. Backfill ties are broken by id ASC
      // for determinism.
      db.exec(`ALTER TABLE dossiers ADD COLUMN dossier_number INTEGER;`);
      const rows = db
        .prepare(`SELECT id FROM dossiers ORDER BY created_at ASC, id ASC`)
        .all() as Array<{ id: string }>;
      const update = db.prepare(`UPDATE dossiers SET dossier_number = ? WHERE id = ?`);
      let n = 1;
      for (const row of rows) {
        update.run(n, row.id);
        n += 1;
      }
      db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_dossiers_number ON dossiers(dossier_number);`);
    },
  },
  {
    version: 6,
    up: (db) => {
      // Track which invite code created each dossier so the delete endpoint
      // can authorize "you created this, you can delete it." Nullable: rows
      // created before v6, BYOK rows, and dossiers created with the gate
      // disabled all stay NULL — those have no auth signal and can't be
      // deleted via the web (operator-deletable via admin only).
      db.exec(`ALTER TABLE dossiers ADD COLUMN created_by_code TEXT;`);
      db.exec(`CREATE INDEX IF NOT EXISTS idx_dossiers_created_by_code ON dossiers(created_by_code);`);
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

// Persist a dossier. Atomically allocates the next per-instance sequential
// number (MAX(dossier_number) + 1) and assigns it to d.number; the same
// number is written to both the dedicated column and the serialized body
// so it round-trips through future reads.
//
// `opts.createdByCode` records which invite code created this dossier so the
// delete endpoint can authorize "you created this, you can delete it." Pass
// null/undefined for BYOK or gate-disabled requests; those dossiers won't
// be deletable via the web.
//
// Mutates the input — callers (the streaming route) read d.number after to
// emit it in the SSE `done` event so the client renders the right header
// without waiting for a re-fetch.
export function saveDossier(
  d: Dossier,
  opts: { createdByCode?: string | null } = {},
): void {
  const db = getDb();
  const createdByCode = opts.createdByCode ?? null;
  db.transaction(() => {
    const row = db
      .prepare(`SELECT COALESCE(MAX(dossier_number), 0) AS m FROM dossiers`)
      .get() as { m: number };
    d.number = row.m + 1;
    db.prepare(
      `INSERT OR REPLACE INTO dossiers
         (id, claim, created_at, body, subclaim_count, has_crux, dossier_number, created_by_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      d.id,
      d.claim,
      d.createdAt,
      JSON.stringify(d),
      d.subClaims.length,
      d.crux ? 1 : 0,
      d.number,
      createdByCode,
    );
  })();
}

// Returns the parsed dossier plus the creator's invite code (or null for
// pre-v6, BYOK, and gate-disabled rows). The route layer compares the code
// to the requester's x-invite-code header to compute canDelete for the
// wire response — keeping the raw creator code server-side so it isn't
// exposed to permalink visitors.
export function getDossier(
  id: string,
): { dossier: Dossier; createdByCode: string | null } | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT body, dossier_number, created_by_code FROM dossiers WHERE id = ?`,
    )
    .get(id) as
    | { body: string; dossier_number: number | null; created_by_code: string | null }
    | undefined;
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.body) as Dossier;
    // Patch number from the column. Bodies written before migration v5 don't
    // have it in the JSON; the column was backfilled at migration time.
    if (row.dossier_number !== null) parsed.number = row.dossier_number;
    return { dossier: parsed, createdByCode: row.created_by_code };
  } catch {
    return null;
  }
}

// Lightweight creator-code lookup used by the DELETE route — avoids parsing
// the (potentially large) body blob just to authorize the request.
export function getDossierCreatorCode(id: string): string | null | undefined {
  const db = getDb();
  const row = db
    .prepare(`SELECT created_by_code FROM dossiers WHERE id = ?`)
    .get(id) as { created_by_code: string | null } | undefined;
  return row ? row.created_by_code : undefined;
}

export interface ListCursor {
  createdAt: string;
  id: string;
}

// Internal shape — includes createdByCode so the route can compute canDelete
// before mapping to the wire-format DossierSummary. Never sent to clients.
export interface InternalDossierSummary extends DossierSummary {
  createdByCode: string | null;
}

export interface ListPage {
  rows: InternalDossierSummary[];
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

  let rows: InternalDossierSummary[];
  if (opts.cursor) {
    rows = db
      .prepare(
        `SELECT id, dossier_number AS number, claim, created_at AS createdAt,
                created_by_code AS createdByCode
         FROM dossiers
         WHERE created_at < ? OR (created_at = ? AND id < ?)
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(opts.cursor.createdAt, opts.cursor.createdAt, opts.cursor.id, fetchLimit) as InternalDossierSummary[];
  } else {
    rows = db
      .prepare(
        `SELECT id, dossier_number AS number, claim, created_at AS createdAt,
                created_by_code AS createdByCode
         FROM dossiers
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
      )
      .all(fetchLimit) as InternalDossierSummary[];
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

// ─── Invite-code lifetime quota ──────────────────────────────────────────────
// Atomically checks the lifetime usage for `code` against `lifetimeLimit` and,
// if allowed, increments today's row in invite_usage. Returns
// `{ allowed: true, total: <new lifetime sum> }` on success or
// `{ allowed: false, total: <current sum> }` when the cap is hit.
//
// The check + increment is one transaction so concurrent requests on the same
// code can't sneak past the cap by a race-condition margin.
export function tryConsumeInviteQuota(
  code: string,
  day: string,
  lifetimeLimit: number,
): { allowed: boolean; total: number } {
  const db = getDb();
  return db.transaction(() => {
    const totalRow = db
      .prepare(`SELECT COALESCE(SUM(count), 0) AS total FROM invite_usage WHERE code = ?`)
      .get(code) as { total: number };
    if (totalRow.total >= lifetimeLimit) {
      return { allowed: false as const, total: totalRow.total };
    }
    db.prepare(
      `INSERT INTO invite_usage (code, day, count) VALUES (?, ?, 1)
       ON CONFLICT(code, day) DO UPDATE SET count = count + 1`,
    ).run(code, day);
    return { allowed: true as const, total: totalRow.total + 1 };
  })();
}

// Read-only lifetime sum for a code. Used by the user-facing usage helper.
export function getInviteCodeLifetimeUsage(code: string): number {
  const db = getDb();
  const row = db
    .prepare(`SELECT COALESCE(SUM(count), 0) AS total FROM invite_usage WHERE code = ?`)
    .get(code) as { total: number };
  return row.total;
}

// ─── Invite-code lifecycle (v4) ──────────────────────────────────────────────
// Codes live in invite_codes; usage counters live in invite_usage (above).
// The two tables are loosely linked by the `code` column — invite_usage rows
// can outlive their invite_codes row (revoked codes keep their usage history)
// and vice versa (a freshly-minted code has no usage rows yet).

export type InviteCodeSource = "env" | "auto" | "manual";

export interface InviteCodeRow {
  code: string;
  source: InviteCodeSource;
  createdAt: string;
  requestIp: string | null;
  revokedAt: string | null;
}

// Insert a code if not already present. Returns true on insert, false if the
// code already existed (env-seed shouldn't clobber a manual/auto entry, and
// auto-mint uses this to detect collisions and re-roll).
export function insertInviteCode(
  code: string,
  source: InviteCodeSource,
  requestIp: string | null,
): boolean {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO invite_codes (code, source, created_at, request_ip)
       VALUES (?, ?, ?, ?)`,
    )
    .run(code, source, new Date().toISOString(), requestIp);
  return result.changes > 0;
}

// True if the code exists and has not been revoked. The gate calls this
// before consuming quota.
export function isInviteCodeAccepted(code: string): boolean {
  const db = getDb();
  const row = db
    .prepare(`SELECT revoked_at FROM invite_codes WHERE code = ?`)
    .get(code) as { revoked_at: string | null } | undefined;
  if (!row) return false;
  return row.revoked_at === null;
}

// Soft-revoke. Returns true if a row was updated (idempotent: revoking an
// already-revoked code returns false). Usage history is preserved.
export function revokeInviteCode(code: string): boolean {
  const db = getDb();
  const result = db
    .prepare(`UPDATE invite_codes SET revoked_at = ? WHERE code = ? AND revoked_at IS NULL`)
    .run(new Date().toISOString(), code);
  return result.changes > 0;
}

// Count auto-mints that happened today (UTC) — used to enforce the
// site-wide daily cap on the auto-mint endpoint.
export function countAutoMintsSince(isoTimestamp: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM invite_codes
       WHERE source = 'auto' AND created_at >= ?`,
    )
    .get(isoTimestamp) as { n: number };
  return row.n;
}

// Count auto-mints from a given IP within a recent window — used to enforce
// the per-IP successful-mint rate limit (refinement attempts are free; only
// successful mints burn the quota).
export function countAutoMintsByIpSince(ip: string, isoTimestamp: string): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM invite_codes
       WHERE source = 'auto' AND request_ip = ? AND created_at >= ?`,
    )
    .get(ip, isoTimestamp) as { n: number };
  return row.n;
}

// All codes, newest first. Joined with invite_usage to surface lifetime usage
// per code — keeps the admin CLI's list view in one query.
export function listInviteCodes(): Array<InviteCodeRow & { usage: number }> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         c.code        AS code,
         c.source      AS source,
         c.created_at  AS createdAt,
         c.request_ip  AS requestIp,
         c.revoked_at  AS revokedAt,
         COALESCE((SELECT SUM(count) FROM invite_usage u WHERE u.code = c.code), 0) AS usage
       FROM invite_codes c
       ORDER BY c.created_at DESC`,
    )
    .all() as Array<InviteCodeRow & { usage: number }>;
  return rows;
}

// Idempotent. Reads INVITE_CODES env, inserts each as source='env'. Existing
// rows (any source) are left alone — env var stays a seed, never an authority.
// Called from invites.ts on each gate check (cached) and from the admin CLI.
export function seedInviteCodesFromEnv(envValue: string | undefined): number {
  const codes = (envValue ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (codes.length === 0) return 0;
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO invite_codes (code, source, created_at, request_ip)
     VALUES (?, 'env', ?, NULL)`,
  );
  const tx = db.transaction((items: string[]): number => {
    let inserted = 0;
    for (const c of items) {
      const result = stmt.run(c, now);
      if (result.changes > 0) inserted += 1;
    }
    return inserted;
  });
  return tx(codes);
}
