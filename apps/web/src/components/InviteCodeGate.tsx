import { useState, type FormEvent } from "react";
import { checkInviteCode } from "../lib/api.js";
import { setInviteCode } from "../lib/invites.js";

interface Props {
  // Pre-filled reason from the API (e.g. "invalid invite code"). Optional.
  reason?: string;
  // Called after the user successfully enters a code. The parent retries
  // whatever request failed, or just unmounts the gate.
  onAccepted: () => void;
}

type Phase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "rejected"; message: string };

// Renders when an /api/dossier call comes back 401 (invite_required) — or
// when the user proactively wants to set a code. Validates the code against
// the API's read-only check endpoint BEFORE storing it, so the user finds
// out a bad code is bad before submitting a claim.
export function InviteCodeGate({ reason, onAccepted }: Props) {
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setPhase({ kind: "checking" });
    const result = await checkInviteCode(trimmed);
    if (result.status === "valid") {
      setInviteCode(trimmed);
      onAccepted();
      return;
    }
    if (result.status === "invalid") {
      setPhase({
        kind: "rejected",
        message: "That code isn't recognized. Check for typos, capitalization, or extra spaces.",
      });
      return;
    }
    if (result.status === "exhausted") {
      setPhase({
        kind: "rejected",
        message:
          "That code's lifetime quota is used up. Request a new one or set up your own API keys in Settings.",
      });
      return;
    }
    // network / server error
    setPhase({
      kind: "rejected",
      message: `Couldn't verify the code right now (${result.detail}). Try again in a moment.`,
    });
  }

  const isChecking = phase.kind === "checking";
  const rejectedMsg = phase.kind === "rejected" ? phase.message : null;

  return (
    <form onSubmit={handleSubmit} className="border border-stone-400 bg-stone-50">
      <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
        <span className="pf-label-loud text-sm text-accent">Invite Code Required</span>
      </div>
      <div className="space-y-4 p-5">
        <p className="font-serif text-base leading-relaxed text-stone-800">
          Every claim you submit to Proofiness triggers multiple calls to AI and web-search providers that accrue charges. With an invite code, you'll be able to submit five claims &dash; that is, create five dossiers &mdash; free of charge. When you've used your allotment, you can obtain your own API keys from those providers and create an unlimited number of dossiers, with the charges billed to you.{" "}
          {reason && (
            <span className="font-serif italic text-stone-600">— {reason}</span>
          )}
        </p>
        <p className="font-serif text-sm leading-relaxed text-stone-700">
          Don't have a code?{" "}
          <a
            href="#/request-invite"
            className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
          >
            Submit your first claim
          </a>
          {" "}&mdash; if it's specific enough to fact-check, we'll issue you one on the spot.
        </p>

        <label className="block">
          <span className="pf-label">Your invite code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (phase.kind === "rejected") setPhase({ kind: "idle" });
            }}
            placeholder="paste here"
            autoComplete="off"
            spellCheck={false}
            disabled={isChecking}
            className="mt-2 block w-full border border-stone-300 bg-white px-3 py-2 font-mono text-sm tracking-wide text-ink placeholder:text-stone-400 focus:border-ink focus:outline-none disabled:bg-stone-100 disabled:text-stone-500"
          />
        </label>

        {rejectedMsg && (
          <p className="border-l-2 border-oxblood bg-stone-100 px-3 py-2 font-serif text-sm leading-relaxed text-stone-900">
            <span className="font-display font-bold uppercase tracking-widish text-oxblood">
              Largely contradicted
            </span>{" "}
            — {rejectedMsg}
          </p>
        )}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!code.trim() || isChecking}
            className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
          >
            {isChecking ? "Checking…" : "Continue"}
          </button>
        </div>
      </div>
    </form>
  );
}
