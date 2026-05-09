// Self-service invite mint. The user submits a claim they'd like to verify;
// the existing claim normalizer is the gate. If normalize returns "ok", we
// mint a fresh code and return it. If normalize rejects (too vague / not a
// claim), we return the suggestions so the user can refine and resubmit.
//
// This sidesteps the "Claude evaluates your stated intent" design we briefly
// considered — no new prompt, no political-balance audit needed, no
// judgment of who you are. The friction (writing a verifiable claim) is the
// same friction the user is here for.
//
// Cost protection (stacked):
//   1. Global rate limit (server.ts default, 60/min/IP)
//   2. Per-IP successful-mint cap (AUTO_MINT_RATE_LIMIT_PER_IP per hour) —
//      refinement attempts are free; only successful mints burn the quota.
//   3. Site-wide daily mint cap (AUTO_MINT_DAILY_CAP) — circuit breaker if
//      the per-IP cap is bypassed via IP rotation.
//   4. Per-code lifetime quota (existing INVITE_DOSSIER_LIMIT) — bounds the
//      damage of any single code that gets minted.
//   5. Hard billing alerts at Anthropic + Tavily — final backstop.

import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ClaimRejectedError, normalize } from "../pipeline/normalize.js";
import {
  countAutoMintsByIpSince,
  countAutoMintsSince,
  insertInviteCode,
} from "../lib/db.js";

const RequestInviteSchema = z.object({
  claim: z.string().trim().min(3, "Claim is too short").max(4000, "Claim is too long"),
});

function isAutoMintEnabled(): boolean {
  return process.env.AUTO_MINT_ENABLED === "true";
}

function getDailyCap(): number {
  const n = Number.parseInt(process.env.AUTO_MINT_DAILY_CAP ?? "20", 10);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

function getPerIpCap(): number {
  const n = Number.parseInt(process.env.AUTO_MINT_RATE_LIMIT_PER_IP ?? "3", 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

// Start-of-today in UTC, as ISO timestamp. countAutoMintsSince does an
// inclusive >= comparison so this becomes "all mints today (UTC)".
function startOfTodayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// One hour ago, as ISO timestamp. The per-IP cap is a rolling 1-hour window.
function oneHourAgoIso(): string {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

// `pf-` prefix + 8 hex chars (32 bits / 4B combos). Plenty for the project's
// expected lifetime mint volume and avoids collision worries against the
// modest scale we expect.
function generateCode(): string {
  return `pf-${randomBytes(4).toString("hex")}`;
}

export async function requestInviteRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/request-invite", async (req, reply) => {
    if (!isAutoMintEnabled()) {
      return reply.code(503).send({
        error: "feature_disabled",
        detail:
          "Self-service invite minting is not available on this instance. Email the operator for a code.",
      });
    }

    const parsed = RequestInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_request",
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const { claim } = parsed.data;
    const ip = req.ip;

    // Site-wide daily cap — checked BEFORE running normalize so we don't
    // burn Haiku calls past the cap. Borderline cases (we hit the cap
    // mid-evaluation) are fine: the worst-case is one extra mint above the
    // nominal cap, which is well within the safety margin.
    const dailyCap = getDailyCap();
    const todayCount = countAutoMintsSince(startOfTodayUtcIso());
    if (todayCount >= dailyCap) {
      return reply.code(503).send({
        error: "daily_cap_reached",
        detail:
          "We've issued the maximum number of invite codes for today. Please try again tomorrow.",
      });
    }

    // Per-IP successful-mint cap — same rationale, cheap to check first.
    const perIpCap = getPerIpCap();
    const ipCount = countAutoMintsByIpSince(ip, oneHourAgoIso());
    if (ipCount >= perIpCap) {
      return reply.code(429).send({
        error: "ip_rate_limit",
        detail: `You've requested ${ipCount} invite code(s) in the last hour. Please wait before requesting another.`,
      });
    }

    // Run the existing claim normalizer. It either returns the normalized
    // claim ("ok" → mint a code) or throws ClaimRejectedError ("too vague"
    // / "not a claim" → return refinement suggestions to the user).
    let normalizedClaim: string;
    try {
      normalizedClaim = await normalize(claim);
    } catch (err) {
      if (err instanceof ClaimRejectedError) {
        return reply.code(200).send({
          status: "needs_more_detail",
          reason: err.reason,
          suggestions: err.suggestions,
        });
      }
      req.log.error({ err }, "request-invite normalize failed");
      return reply.code(500).send({
        error: "evaluation_failed",
        detail: "We couldn't evaluate your claim right now. Please try again in a moment.",
      });
    }

    // Mint and persist. Collisions are vanishingly unlikely with 32 bits of
    // randomness at ~20 mints/day; insertInviteCode returns false on conflict
    // so we re-roll up to 3 times before giving up.
    let code = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidate = generateCode();
      if (insertInviteCode(candidate, "auto", ip)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      req.log.error({ ip }, "request-invite: failed to mint after 3 attempts");
      return reply.code(500).send({
        error: "mint_failed",
        detail: "Couldn't mint a code right now. Please try again in a moment.",
      });
    }

    return reply.code(200).send({
      status: "approved",
      code,
      normalizedClaim,
    });
  });
}
