// Cost gate: invite-code authorization + per-code LIFETIME dossier cap.
//
// The single biggest concern for any deployed instance is unbounded LLM /
// search costs from anonymous traffic. This module is the gate.
//
// Configuration (env):
//   INVITE_CODES          — comma-separated list of accepted codes. Empty/unset
//                           means the gate is OFF (every request passes).
//                           Treat empty as a positive choice for local dev only.
//   INVITE_DOSSIER_LIMIT  — max dossiers per code, LIFETIME (across all days
//                           for that code, ever). Default 10.
//                           At ~$0.20–0.30 per cold dossier, 10 lifetime is
//                           ~$3 worst case per code, total. Once a code hits
//                           the cap, it's exhausted permanently — no daily
//                           reset, no leakage. Bump the env value or hand
//                           the user a fresh code if they need more.
//
// The check is applied only to /api/dossier (the expensive endpoint).
// Read-only routes (GET /api/dossier/:id, GET /api/dossiers) are not gated;
// reading a saved dossier costs nothing.
//
// History is still tracked per-day in invite_usage(code, day, count) so the
// audit trail / future per-code usage UI gets the breakdown for free.

import { getInviteCodeLifetimeUsage, tryConsumeInviteQuota } from "./db.js";

export interface InviteCheckResult {
  ok: boolean;
  status: 401 | 429 | 200;
  reason?: string;
}

const allowedCodesCache: { value: Set<string> | null } = { value: null };

function getAllowedCodes(): Set<string> {
  if (allowedCodesCache.value) return allowedCodesCache.value;
  const raw = (process.env.INVITE_CODES ?? "").trim();
  const codes = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  allowedCodesCache.value = new Set(codes);
  return allowedCodesCache.value;
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
 * Special case: if INVITE_CODES env is empty/unset, the gate is OFF and every
 * request passes (no quota tracked). For local dev only. Production instances
 * MUST set INVITE_CODES.
 */
export function checkInviteAndConsume(code: string | undefined): InviteCheckResult {
  const allowed = getAllowedCodes();
  if (allowed.size === 0) return { ok: true, status: 200 };

  const trimmed = (code ?? "").trim();
  if (!trimmed) {
    return {
      ok: false,
      status: 401,
      reason: "missing invite code — set the x-invite-code request header",
    };
  }
  if (!allowed.has(trimmed)) {
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
