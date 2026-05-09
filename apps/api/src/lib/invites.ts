// Cost gate: invite-code authorization + per-code LIFETIME dossier cap.
//
// The single biggest concern for any deployed instance is unbounded LLM /
// search costs from anonymous traffic. This module is the gate.
//
// Configuration (env):
//   INVITE_CODES          — comma-separated list of accepted codes seeded
//                           into the DB on first run. Adding a code via env
//                           only affects fresh DBs (or freshly-added codes);
//                           existing rows are never clobbered. Auto-mint and
//                           the admin CLI can also add codes at runtime.
//                           Empty + AUTO_MINT_ENABLED=false = gate is OFF
//                           (every request passes). Treat empty as a positive
//                           choice for local dev only.
//   INVITE_DOSSIER_LIMIT  — max dossiers per code, LIFETIME (across all days
//                           for that code, ever). Default 10.
//                           At ~$0.20–0.30 per cold dossier, 10 lifetime is
//                           ~$3 worst case per code, total. Once a code hits
//                           the cap, it's exhausted permanently — no daily
//                           reset, no leakage. Bump the env value or hand
//                           the user a fresh code if they need more.
//   AUTO_MINT_ENABLED     — when "true", /api/request-invite is live and
//                           the gate is ON regardless of INVITE_CODES.
//
// Acceptance source of truth is the invite_codes table; the env var is just
// a startup seed. Removing a code from INVITE_CODES does NOT revoke it
// (would be surprising); use `npm run admin-codes revoke <code>` to revoke.

import {
  getInviteCodeLifetimeUsage,
  isInviteCodeAccepted,
  seedInviteCodesFromEnv,
  tryConsumeInviteQuota,
} from "./db.js";

export interface InviteCheckResult {
  ok: boolean;
  status: 401 | 429 | 200;
  reason?: string;
}

// Read-only variant — same validation logic as checkInviteAndConsume but
// does NOT increment the quota counter. Used by the gate's pre-submit check
// so the user finds out the code is bad before typing a claim, not after.
export interface InviteValidationResult {
  ok: boolean;
  status: 401 | 429 | 200;
  reason?: string;
  remaining?: number;
  limit?: number;
}

export function validateInviteCode(code: string | undefined): InviteValidationResult {
  if (!isCostGateEnabled()) return { ok: true, status: 200 };
  ensureSeeded();

  const trimmed = (code ?? "").trim();
  if (!trimmed) {
    return { ok: false, status: 401, reason: "missing invite code" };
  }
  if (!isInviteCodeAccepted(trimmed)) {
    return { ok: false, status: 401, reason: "invalid invite code" };
  }

  const status = getInviteCodeStatus(trimmed);
  if (status.remaining === 0) {
    return {
      ok: false,
      status: 429,
      reason: `invite code's lifetime quota (${status.limit} dossiers) is exhausted`,
      remaining: 0,
      limit: status.limit,
    };
  }
  return { ok: true, status: 200, remaining: status.remaining, limit: status.limit };
}

let _seeded = false;
function ensureSeeded(): void {
  if (_seeded) return;
  _seeded = true;
  const inserted = seedInviteCodesFromEnv(process.env.INVITE_CODES);
  if (inserted > 0) {
    console.log(`[invites] seeded ${inserted} invite code(s) from INVITE_CODES env`);
  }
}

function isAutoMintEnabled(): boolean {
  return process.env.AUTO_MINT_ENABLED === "true";
}

function isCostGateEnabled(): boolean {
  const hasEnvCodes = (process.env.INVITE_CODES ?? "").trim().length > 0;
  return hasEnvCodes || isAutoMintEnabled();
}

function getLifetimeLimit(): number {
  const n = Number.parseInt(process.env.INVITE_DOSSIER_LIMIT ?? "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

// Today in UTC (YYYY-MM-DD). Used as the day key for per-day rows in
// invite_usage; lifetime totals sum across all days.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Checks the invite code AND increments the counter if allowed. Returns:
 *   - { ok: true }                    — request allowed; counter incremented
 *   - { ok: false, status: 401, ... } — code missing or invalid
 *   - { ok: false, status: 429, ... } — code valid but lifetime quota exhausted
 *
 * The check + increment is one transaction so concurrent requests on the
 * same code can't over-count (race condition would otherwise let a code
 * sneak past the cap by exactly the number of concurrent in-flight requests).
 *
 * Special case: if no cost-gate signal is set (empty INVITE_CODES AND
 * auto-mint disabled), the gate is OFF and every request passes (no quota
 * tracked). For local dev only. Production instances MUST set at least one
 * of INVITE_CODES or AUTO_MINT_ENABLED=true.
 */
export function checkInviteAndConsume(code: string | undefined): InviteCheckResult {
  if (!isCostGateEnabled()) return { ok: true, status: 200 };
  ensureSeeded();

  const trimmed = (code ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 401,
      reason: "missing invite code — set the x-invite-code request header",
    };
  }
  if (!isInviteCodeAccepted(trimmed)) {
    return { ok: false, status: 401, reason: "invalid invite code" };
  }

  const limit = getLifetimeLimit();
  const result = tryConsumeInviteQuota(trimmed, todayUtc(), limit);

  if (!result.allowed) {
    return {
      ok: false,
      status: 429,
      reason: `invite code's lifetime quota (${limit} dossiers) is exhausted; switch to your own API keys or request a new code`,
    };
  }
  return { ok: true, status: 200 };
}

// Read-only — used by future "your usage" UI. Returns {used, limit, remaining}.
export function getInviteCodeStatus(code: string): { used: number; limit: number; remaining: number } {
  const used = getInviteCodeLifetimeUsage(code);
  const limit = getLifetimeLimit();
  return { used, limit, remaining: Math.max(0, limit - used) };
}
