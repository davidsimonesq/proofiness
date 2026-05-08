// Cost gate: invite-code authorization + per-code daily dossier cap.
//
// The single biggest concern for any deployed instance is unbounded LLM /
// search costs from anonymous traffic. This module is the gate.
//
// Configuration (env):
//   INVITE_CODES        — comma-separated list of accepted codes. Empty/unset
//                         means the gate is OFF (every request passes).
//                         Treat empty as a positive choice for local dev only.
//   DAILY_DOSSIER_LIMIT — max dossiers per code per day. Default 10.
//                         At ~$0.10–0.30 per cold dossier, 10/day is ~$3/day
//                         worst case per code.
//
// The check is applied only to /api/dossier (the expensive endpoint).
// Read-only routes (GET /api/dossier/:id, GET /api/dossiers) are not gated;
// reading a saved dossier costs nothing.

import { incrementInviteUsage } from "./db.js";

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

function getDailyLimit(): number {
  const n = Number.parseInt(process.env.DAILY_DOSSIER_LIMIT ?? "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

// Today's date in YYYY-MM-DD UTC. Daily windows are UTC so a code can't get a
// quota reset by traveling east; not a serious threat model, just consistency.
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Checks the invite code AND increments the day's quota if allowed. Returns:
 *   - { ok: true }                        — request allowed; quota incremented
 *   - { ok: false, status: 401, ... }     — code missing or invalid
 *   - { ok: false, status: 429, ... }     — code valid but over daily quota
 *
 * Special case: if INVITE_CODES env is empty/unset, the gate is OFF and every
 * request passes (no quota tracked). This is for local dev. Production
 * instances MUST set INVITE_CODES.
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

  const limit = getDailyLimit();
  const newCount = incrementInviteUsage(trimmed, todayUtc());
  if (newCount > limit) {
    return {
      ok: false,
      status: 429,
      reason: `daily dossier limit (${limit}) exceeded for this invite code; resets 00:00 UTC`,
    };
  }
  return { ok: true, status: 200 };
}
