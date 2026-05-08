import { useState, type FormEvent } from "react";
import { setInviteCode } from "../lib/invites.js";

interface Props {
  // Pre-filled reason from the API (e.g. "invalid invite code"). Optional.
  reason?: string;
  // Called after the user successfully enters a code. The parent retries
  // whatever request failed, or just unmounts the gate.
  onAccepted: () => void;
}

// Renders when an /api/dossier call comes back 401 (invite_required) — or
// when the user proactively wants to set a code. Stores the code in
// localStorage and calls onAccepted; we don't validate against the API here
// because the next dossier request will do that and surface a fresh 401 if
// the code is wrong.
export function InviteCodeGate({ reason, onAccepted }: Props) {
  const [code, setCode] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setInviteCode(trimmed);
    onAccepted();
  }

  return (
    <form onSubmit={handleSubmit} className="border border-stone-400 bg-stone-50">
      <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
        <span className="pf-label-loud">Invite Code Required</span>
      </div>
      <div className="space-y-4 p-5">
        <p className="font-serif text-base leading-relaxed text-stone-800">
          Proofiness is in private beta. Each dossier costs real money in API calls, so
          access is gated by invite code. Each code is good for a fixed number of dossiers
          total — when you've used your allotment, you can request a new code or switch to
          your own API keys.{" "}
          {reason && (
            <span className="font-serif italic text-stone-600">— {reason}</span>
          )}
        </p>
        <p className="font-serif text-sm leading-relaxed text-stone-700">
          Don't have a code? Email{" "}
          <a
            href="mailto:info@proofiness.org?subject=Proofiness%20invite%20request"
            className="font-mono text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
          >
            info@proofiness.org
          </a>
          {" "}with a sentence about how you'd use it.
        </p>

        <label className="block">
          <span className="pf-label">Your invite code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="paste here"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 block w-full border border-stone-300 bg-white px-3 py-2 font-mono text-sm tracking-wide text-ink placeholder:text-stone-400 focus:border-ink focus:outline-none"
          />
        </label>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!code.trim()}
            className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
          >
            Save and continue →
          </button>
        </div>
      </div>
    </form>
  );
}
