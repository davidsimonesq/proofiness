import { useState, type FormEvent } from "react";

interface Props {
  onSubmit: (claim: string, context: string | undefined) => void;
  busy: boolean;
}

export function ClaimInput({ onSubmit, busy }: Props) {
  const [claim, setClaim] = useState("");
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
        <span className="pf-label-loud">Field 01 — Claim</span>
      </div>
      <div className="p-4">
        <label className="block">
          <span className="pf-label">Paste claim verbatim</span>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="One sentence to a paragraph. From news, social media, conversation."
            rows={4}
            className="mt-2 block w-full border border-stone-300 bg-stone-50 px-3 py-2 font-sans text-sm text-ink placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none disabled:bg-stone-200 disabled:text-stone-500"
            disabled={busy}
          />
        </label>

        {showContext ? (
          <label className="mt-4 block">
            <span className="pf-label">Context (optional)</span>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Where you encountered it; what surrounded it. Disambiguates which version of the claim and which counterfactual matters."
              rows={2}
              className="mt-2 block w-full border border-stone-300 bg-stone-50 px-3 py-2 font-sans text-sm text-ink placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none disabled:bg-stone-200 disabled:text-stone-500"
              disabled={busy}
            />
          </label>
        ) : (
          <button
            type="button"
            onClick={() => setShowContext(true)}
            className="mt-3 font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
            disabled={busy}
          >
            + Attach context
          </button>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="font-mono text-[0.65rem] uppercase tracking-widest text-stone-500">
            {busy ? "Pipeline running…" : "Ready"}
          </span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
          >
            {busy ? "Building…" : "Build dossier →"}
          </button>
        </div>
      </div>
    </form>
  );
}
