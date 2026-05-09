// CLI for managing invite codes directly against the SQLite DB. Run as:
//   npm run admin-codes -- list
//   npm run admin-codes -- mint [--label optional-label]
//   npm run admin-codes -- revoke <code>
//
// Operates on the same DB the API uses (PROOFINESS_DB_PATH env, default
// ./data/proofiness.db). Safe to run while the API is up — better-sqlite3
// uses WAL mode so concurrent writers don't block each other for these tiny
// operations.

import "dotenv/config";
import { randomBytes } from "node:crypto";
import {
  insertInviteCode,
  listInviteCodes,
  revokeInviteCode,
} from "../src/lib/db.js";

function generateCode(): string {
  return `pf-${randomBytes(4).toString("hex")}`;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function cmdList(): void {
  const rows = listInviteCodes();
  if (rows.length === 0) {
    console.log("No invite codes in the DB.");
    console.log("Hint: set INVITE_CODES env and restart the API to seed, or use `mint` to create one.");
    return;
  }
  const limit = Number.parseInt(process.env.INVITE_DOSSIER_LIMIT ?? "10", 10);
  console.log(
    pad("CODE", 18) +
      pad("SOURCE", 8) +
      pad("CREATED", 18) +
      pad("USAGE", 10) +
      pad("STATUS", 10) +
      "ORIGIN",
  );
  console.log("─".repeat(80));
  for (const r of rows) {
    const status = r.revokedAt ? "revoked" : r.usage >= limit ? "exhausted" : "active";
    const origin = r.requestIp ?? "—";
    console.log(
      pad(r.code, 18) +
        pad(r.source, 8) +
        pad(fmtDate(r.createdAt), 18) +
        pad(`${r.usage}/${limit}`, 10) +
        pad(status, 10) +
        origin,
    );
  }
}

function cmdMint(args: string[]): void {
  // Parse `--label <value>` for tracking purposes (currently unused — invite_codes
  // doesn't have a label column. Kept as a hook so the flag works for now and
  // can be wired through if/when the column is added).
  const labelIdx = args.indexOf("--label");
  const label = labelIdx >= 0 && args[labelIdx + 1] ? args[labelIdx + 1] : null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateCode();
    if (insertInviteCode(code, "manual", null)) {
      console.log(`Minted: ${code}`);
      if (label) console.log(`(label: ${label} — note: not yet stored in DB)`);
      return;
    }
  }
  console.error("Failed to mint code after 3 attempts (collisions?).");
  process.exit(1);
}

function cmdRevoke(args: string[]): void {
  const code = args[0];
  if (!code) {
    console.error("Usage: admin-codes revoke <code>");
    process.exit(1);
  }
  const revoked = revokeInviteCode(code);
  if (revoked) {
    console.log(`Revoked: ${code}`);
  } else {
    console.log(`Nothing to revoke (not found or already revoked): ${code}`);
    process.exit(1);
  }
}

function usage(): void {
  console.log("Usage:");
  console.log("  admin-codes list");
  console.log("  admin-codes mint [--label name]");
  console.log("  admin-codes revoke <code>");
}

const [, , subcommand, ...rest] = process.argv;
switch (subcommand) {
  case "list":
    cmdList();
    break;
  case "mint":
    cmdMint(rest);
    break;
  case "revoke":
    cmdRevoke(rest);
    break;
  default:
    usage();
    process.exit(subcommand ? 1 : 0);
}
