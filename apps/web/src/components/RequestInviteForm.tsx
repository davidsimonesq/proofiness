import { useState, type FormEvent } from "react";
import { requestInvite, type RequestInviteResult } from "../lib/api.js";
import { setInviteCode } from "../lib/invites.js";
import { setPendingClaim } from "../lib/pending-claim.js";
import { APP_HASH, navigate } from "../lib/route.js";
import { SectionHeader } from "../App.js";

// Self-service invite mint flow. The user submits a claim they'd like to
// verify; the server runs the existing claim normalizer on it. Acceptable
// claims earn an invite code (auto-stored in localStorage) and immediately
// hand off into the dossier flow on the same claim. Vague/non-claim
// submissions get refinement suggestions and stay on the page.

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "result"; result: RequestInviteResult };

export function RequestInviteForm() {
  const [claim, setClaim] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = claim.trim();
    if (trimmed.length < 3) return;
    setPhase({ kind: "loading" });
    const result = await requestInvite(trimmed);
    // On approval, store the code immediately and hand off the (normalized)
    // claim to the app route so the dossier starts without a second click
    // unless the user wants to.
    if (result.status === "approved") {
      setInviteCode(result.code);
    }
    setPhase({ kind: "result", result });
  }

  function startDossierNow() {
    if (phase.kind !== "result" || phase.result.status !== "approved") return;
    setPendingClaim(phase.result.normalizedClaim);
    navigate(APP_HASH);
  }

  function handleRefine() {
    if (phase.kind !== "result") return;
    setPhase({ kind: "idle" });
  }

  function applySuggestion(s: string) {
    setClaim(s);
    setPhase({ kind: "idle" });
  }

  const showForm = phase.kind === "idle" || phase.kind === "loading";
  const isLoading = phase.kind === "loading";

  return (
    <article className="space-y-8">
      <a
        href="#/"
        className="inline-block font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
      >
        ← Index
      </a>

      <SectionHeader number="R" label="Request an Invite" />

      <div className="border border-stone-300 bg-white p-6 sm:p-8">
        <p className="font-serif text-base leading-relaxed text-stone-800">
          Type a claim you'd like to verify. If it's specific enough to
          fact-check, we'll issue you an invite code on the spot and start
          your first dossier. If it's too vague, we'll suggest sharper
          versions you can pick from.
        </p>
        <p className="mt-3 font-serif text-sm italic leading-relaxed text-stone-700">
          We don't ask for your email or anything else. Codes live only in
          your browser's localStorage — save the code somewhere if you want
          to use it from another browser later.
        </p>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="border border-stone-400 bg-white">
          <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
            <span className="pf-label-loud">Your first claim</span>
          </div>
          <div className="space-y-4 p-5">
            <textarea
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="e.g., Vitamin D supplements reduce the risk of respiratory infections in adults."
              rows={4}
              autoFocus
              spellCheck
              disabled={isLoading}
              className="block w-full border border-stone-300 bg-stone-50 px-3 py-2 font-serif text-base leading-relaxed text-ink placeholder:font-serif placeholder:italic placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                {isLoading ? "Reviewing your claim…" : "A specific, checkable claim works best"}
              </span>
              <button
                type="submit"
                disabled={isLoading || claim.trim().length < 3}
                className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
              >
                {isLoading ? "Reviewing…" : "Submit claim →"}
              </button>
            </div>
          </div>
        </form>
      )}

      {phase.kind === "result" && (
        <ResultPanel
          result={phase.result}
          onUseNow={startDossierNow}
          onRefine={handleRefine}
          onApplySuggestion={applySuggestion}
        />
      )}
    </article>
  );
}

interface ResultPanelProps {
  result: RequestInviteResult;
  onUseNow: () => void;
  onRefine: () => void;
  onApplySuggestion: (s: string) => void;
}

function ResultPanel({ result, onUseNow, onRefine, onApplySuggestion }: ResultPanelProps) {
  if (result.status === "approved") {
    return (
      <div className="border border-accent-dim bg-stone-50">
        <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
          <span className="font-display text-xs font-bold uppercase tracking-widish text-accent">
            ✓ Invite code created
          </span>
        </div>
        <div className="space-y-4 p-5">
          <p className="font-serif text-base leading-relaxed text-stone-800">
            Your code is saved in this browser. Save it somewhere if you
            think you'll want to use Proofiness from another browser later
            — we have no way to send it to you again.
          </p>
          <dl className="grid gap-x-6 gap-y-1 font-mono text-sm text-stone-700 sm:grid-cols-[max-content_1fr]">
            <dt className="text-stone-500">Your code</dt>
            <dd className="select-all font-bold text-ink">{result.code}</dd>
          </dl>
          <p className="font-serif text-sm italic leading-relaxed text-stone-700">
            Ready to verify your claim? We'll start the dossier on the
            normalized version below.
          </p>
          <blockquote className="border-l-2 border-stone-400 pl-3 font-serif text-sm leading-relaxed text-stone-800">
            {result.normalizedClaim}
          </blockquote>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onUseNow}
              className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800"
            >
              Run the dossier →
            </button>
            <a
              href="#/app"
              className="font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
            >
              I'll start a different claim
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (result.status === "needs_more_detail") {
    return (
      <div className="border border-stone-400 bg-stone-100">
        <div className="border-b border-stone-300 bg-stone-50 px-4 py-2">
          <span className="pf-label-loud">Needs more detail</span>
        </div>
        <div className="space-y-4 p-5">
          <p className="font-serif text-base leading-relaxed text-stone-800">{result.reason}</p>
          {result.suggestions.length > 0 && (
            <>
              <p className="pf-label">Try one of these instead</p>
              <ul className="space-y-1.5">
                {result.suggestions.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => onApplySuggestion(s)}
                      className="block w-full border border-stone-300 bg-white px-3 py-2 text-left font-sans text-sm text-stone-900 hover:border-ink hover:bg-stone-50"
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            type="button"
            onClick={onRefine}
            className="border border-stone-500 bg-white px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink hover:text-ink"
          >
            Edit my claim
          </button>
        </div>
      </div>
    );
  }

  if (result.status === "feature_disabled") {
    return <SimpleErrorPanel title="Self-service invites are off" detail={result.detail} />;
  }
  if (result.status === "daily_cap_reached") {
    return <SimpleErrorPanel title="At capacity for today" detail={result.detail} />;
  }
  if (result.status === "ip_rate_limit") {
    return <SimpleErrorPanel title="Too many requests" detail={result.detail} />;
  }
  if (result.status === "invalid_request") {
    return <SimpleErrorPanel title="Couldn't process that" detail={result.detail} />;
  }
  return <SimpleErrorPanel title="Something went wrong" detail={result.detail} />;
}

function SimpleErrorPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="border border-oxblood bg-stone-100 p-5">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-oxblood">{title}</p>
      <p className="mt-2 font-serif text-sm leading-relaxed text-stone-900">{detail}</p>
    </div>
  );
}
