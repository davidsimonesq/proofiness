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
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700">Claim</span>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Paste a claim from news, social media, or a conversation. One sentence to a paragraph works best."
          rows={4}
          className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          disabled={busy}
        />
      </label>

      {showContext ? (
        <label className="block">
          <span className="block text-sm font-medium text-slate-700">
            Context <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Where did you encounter this? What surrounded it? Helps the decomposition."
            rows={2}
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            disabled={busy}
          />
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setShowContext(true)}
          className="text-xs text-slate-600 underline hover:text-slate-900"
          disabled={busy}
        >
          + Add context
        </button>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {busy ? "Building dossier…" : "Build dossier"}
      </button>
    </form>
  );
}
