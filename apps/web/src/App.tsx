import { useEffect, useRef, useState } from "react";
import type { Dossier, ProgressEvent, ProgressStep } from "@crux/shared-types";
import { ClaimInput } from "./components/ClaimInput.js";
import { DossierView } from "./components/DossierView.js";
import { ProgressIndicator } from "./components/ProgressIndicator.js";
import { HistoryList } from "./components/HistoryList.js";
import { getDossier, streamDossier, type DossierError } from "./lib/api.js";
import { buildDossierHash, navigate, useRoute } from "./lib/route.js";

const PROGRESS_STEP_LABELS: Record<ProgressStep, string> = {
  normalizing: "claim normalization",
  decomposing: "decomposition",
  searching: "search",
  fetching: "source fetching",
  classifying_sources: "source classification",
  tracing_provenance: "provenance tracing",
  generating_steelmans: "steelman generation",
  classifying_contestation: "contestation classification",
  identifying_crux: "crux identification",
  persisting: "saving",
};

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; progress: ProgressEvent | null }
  // Audit #13: preserve last-progress so the user can see WHICH step failed.
  | { kind: "error"; error: DossierError; lastProgress: ProgressEvent | null }
  | { kind: "ready"; dossier: Dossier };

export default function App() {
  const route = useRoute();

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <Header />
      {route.kind === "dossier" ? (
        <DossierRoute id={route.id} />
      ) : (
        <HomeRoute />
      )}
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="mb-6 sm:mb-10">
      <a href="#/" className="inline-block">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Crux</h1>
      </a>
      <p className="mt-1 text-sm text-slate-600">
        Paste a claim. Get an evidence dossier — never a verdict. You judge.
      </p>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-4 text-xs text-slate-500">
      Crux is part of the i-Resist civic tech suite.
    </footer>
  );
}

function HomeRoute() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Track the most recent progress in a ref so the error handler can capture it.
  // (State is async; reading phase from the closure inside onError would be stale.)
  const lastProgressRef = useRef<ProgressEvent | null>(null);

  async function handleSubmit(claim: string, context: string | undefined) {
    lastProgressRef.current = null;
    setPhase({ kind: "loading", progress: null });
    await streamDossier(
      { claim, context },
      {
        onProgress: (event) => {
          lastProgressRef.current = event;
          setPhase({ kind: "loading", progress: event });
        },
        onDone: (dossier) => {
          // Navigate to the dossier's permalink so refresh + share work.
          navigate(buildDossierHash(dossier.id));
        },
        onError: (error) =>
          setPhase({ kind: "error", error, lastProgress: lastProgressRef.current }),
      },
    );
  }

  function handleSuggestionClick(suggestion: string) {
    handleSubmit(suggestion, undefined);
  }

  return (
    <>
      {(phase.kind === "idle" || phase.kind === "error") && (
        <ClaimInput onSubmit={handleSubmit} busy={false} />
      )}

      {phase.kind === "error" && (
        <ErrorPanel error={phase.error} lastProgress={phase.lastProgress} onSuggestionClick={handleSuggestionClick} />
      )}

      {phase.kind === "loading" && (
        <div className="mt-6 space-y-3">
          <ClaimInput onSubmit={() => undefined} busy={true} />
          <ProgressIndicator current={phase.progress} />
        </div>
      )}

      <section className="mt-10 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Recent dossiers
        </h2>
        <HistoryList />
      </section>
    </>
  );
}

interface ErrorPanelProps {
  error: DossierError;
  lastProgress: ProgressEvent | null;
  onSuggestionClick: (suggestion: string) => void;
}

function ErrorPanel({ error, lastProgress, onSuggestionClick }: ErrorPanelProps) {
  if (error.kind === "claim_rejected") {
    return (
      <div className="mt-6 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">
          {error.status === "too_vague" ? "Claim is too vague to investigate" : "Not a factual claim"}
        </p>
        <p className="mt-1">{error.reason}</p>
        {error.suggestions.length > 0 && (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-700">
              Try one of these instead
            </p>
            <ul className="mt-1 space-y-1.5">
              {error.suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => onSuggestionClick(s)}
                    className="block w-full rounded border border-amber-300 bg-white px-3 py-2 text-left text-sm text-slate-800 hover:bg-amber-100"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  }

  // Generic failure — show last step reached so the user can tell where it broke.
  return (
    <div className="mt-6 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1">{error.message}</p>
      {lastProgress && (
        <p className="mt-2 text-xs text-rose-700">
          Failed at: <span className="font-medium">{PROGRESS_STEP_LABELS[lastProgress.step]}</span>
          {lastProgress.sublabel && <> ({lastProgress.sublabel})</>}
        </p>
      )}
      {error.requestId && (
        <p className="mt-2 text-xs text-rose-700">
          Request ID: <code className="font-mono">{error.requestId}</code>
        </p>
      )}
    </div>
  );
}

function DossierRoute({ id }: { id: string }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "error"; message: string }
    | { kind: "ready"; dossier: Dossier }
  >({ kind: "loading" });

  useEffect(() => {
    setState({ kind: "loading" });
    getDossier(id)
      .then((dossier) => setState({ kind: "ready", dossier }))
      .catch((err: Error) => setState({ kind: "error", message: err.message }));
  }, [id]);

  return (
    <>
      <a href="#/" className="mb-4 inline-block text-sm text-slate-600 underline hover:text-slate-900">
        ← Home
      </a>
      {state.kind === "loading" && <p className="text-sm text-slate-600">Loading dossier…</p>}
      {state.kind === "error" && (
        <div className="rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-semibold">Couldn't load dossier</p>
          <p className="mt-1">{state.message}</p>
        </div>
      )}
      {state.kind === "ready" && <DossierView dossier={state.dossier} />}
    </>
  );
}
