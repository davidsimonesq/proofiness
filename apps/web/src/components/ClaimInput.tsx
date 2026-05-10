import { useState, type FormEvent } from "react";

interface Props {
  onSubmit: (claim: string, context: string | undefined) => void;
  busy: boolean;
  // Seeds the textarea on mount. Used by the auto-mint handoff (the user
  // just got an invite code by submitting a claim and asked us to run the
  // dossier on it) and to keep the claim visible while the dossier streams
  // so the user remembers what they're verifying. The component owns its
  // own state after mount, so the user can edit + resubmit normally.
  initialClaim?: string;
}

export function ClaimInput({ onSubmit, busy, initialClaim }: Props) {
  const [claim, setClaim] = useState(initialClaim ?? "");
  const [context, setContext] = useState("");
  const [showContext, setShowContext] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedClaim = claim.trim();
    if (trimmedClaim.length < 3) return;
    onSubmit(trimmedClaim, context.trim() || undefined);
  }

  const canSubmit = !busy && claim.trim().length >= 3;

  return (
    <form onSubmit={handleSubmit} className="border border-stone-300 bg-white">
      <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
        <span className="pf-label-loud text-lg text-accent">Factual Claim To Assess</span>
      </div>
      <div className="p-4">
        <label className="block">
          <span className="pf-label">Type or paste the claim verbatim</span>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="Enter one or two sentences &mdash; a paragraph at most &mdash; from news, social media, conversation, etc."
            rows={4}
            className="mt-2 block w-full border-2 border-accent bg-stone-50 px-3 py-2 font-sans text-sm text-ink placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none disabled:bg-stone-200 disabled:text-stone-500"
            disabled={busy}
          />
        </label>

        {showContext ? (
          <label className="mt-4 block">
            <span className="pf-label">Add Context</span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Where did you encounter the claim? What surrounded it? Adding context can improve the dossier."
              rows={2}
              className="mt-2 block w-full border border-accent bg-stone-50 px-3 py-2 font-sans text-sm text-ink placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none disabled:bg-stone-200 disabled:text-stone-500"
              disabled={busy}
            />
          </label>
        ) : !busy ? (
          <button
            type="button"
            onClick={() => setShowContext(true)}
            className="mt-3 font-mono text-lg uppercase tracking-widish text-accent hover:text-ink"
          >
            + Add context <span className="text-xs text-stone-600">(optional)</span>
          </button>
        ) : null}

        <div className="mt-5 flex items-center justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
          >
            {busy ? "Assessing claim…" : "Assess the Claim →"}
          </button>
        </div>
      </div>
    </form>
  );
}
