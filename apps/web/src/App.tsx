import { useEffect, useRef, useState } from "react";
import type { Dossier, ProgressEvent, ProgressStep } from "@proofiness/shared-types";
import { ClaimInput } from "./components/ClaimInput.js";
import { DossierView } from "./components/DossierView.js";
import { ProgressIndicator } from "./components/ProgressIndicator.js";
import { HistoryList } from "./components/HistoryList.js";
import { StaticPage } from "./components/StaticPage.js";
import { LandingPage } from "./components/LandingPage.js";
import { getDossier, streamDossier, type DossierError } from "./lib/api.js";
import {
  APP_HASH,
  buildDossierHash,
  buildStaticHash,
  navigate,
  useRoute,
  type Route,
} from "./lib/route.js";

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
  assessing: "top-line assessment",
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
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <Header route={route} />
      {renderRoute(route)}
      <Footer />
    </main>
  );
}

function renderRoute(route: Route) {
  switch (route.kind) {
    case "landing":
      return <LandingPage />;
    case "app":
      return <AppRoute />;
    case "dossier":
      return <DossierRoute id={route.id} />;
    case "static":
      return <StaticPage slug={route.slug} />;
    case "unknown":
    default:
      return <LandingPage />;
  }
}

function Header({ route }: { route: Route }) {
  // "Open the App" CTA visible on landing and static pages — places where the
  // user might be reading and want to get to the tool without scrolling. Hidden
  // on app and dossier views (they're already in the tool).
  const showAppLink = route.kind === "landing" || route.kind === "static";
  return (
    <header className="mb-8 sm:mb-12">
      {/* Top hairline + serial number — establishes the document genre */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[0.65rem] uppercase tracking-widest text-stone-500">
          i-Resist · Civic Tech · PRF-001
        </span>
        {showAppLink && (
          <a
            href={APP_HASH}
            className="font-display text-xs font-semibold uppercase tracking-widish text-ink hover:text-accent"
          >
            Open the App →
          </a>
        )}
      </div>
      <div className="pf-rule" />
      <div className="flex items-end justify-between gap-4 pt-3">
        <a href="#/" className="block">
          <h1 className="font-display text-4xl font-bold uppercase tracking-widish text-ink sm:text-5xl">
            Proofiness
          </h1>
          <p className="mt-1 font-serif text-lg italic text-stone-600">
            The Quest for Truth — with Receipts!
          </p>
        </a>
      </div>
      <p className="mt-4 max-w-prose font-serif text-sm leading-relaxed text-stone-700">
        Paste a claim. Proofiness decomposes it, traces the citations to their headwater,
        steelmans both sides, and returns a calibrated, plain-language assessment with the
        full case file behind it. <span className="italic">Read the answer in 30 seconds, dig in when you want to.</span>
      </p>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16">
      <div className="pf-rule mb-4" />
      <nav
        aria-label="Footer"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-xs font-semibold uppercase tracking-widish text-stone-700"
      >
        <FooterLink slug="about">About</FooterLink>
        <span className="text-stone-400" aria-hidden="true">·</span>
        <FooterLink slug="privacy">Privacy</FooterLink>
        <span className="text-stone-400" aria-hidden="true">·</span>
        <FooterLink slug="terms">Terms</FooterLink>
        <span className="text-stone-400" aria-hidden="true">·</span>
        <FooterLink slug="help">Help</FooterLink>
        <span className="text-stone-400" aria-hidden="true">·</span>
        <a
          href="https://github.com/davidsimonesq/proofiness"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink"
        >
          GitHub ↗
        </a>
      </nav>
      <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-widest text-stone-500">
        i-Resist Civic Tech Suite · Assessments calibrated, sources visible
      </p>
    </footer>
  );
}

function FooterLink({
  slug,
  children,
}: {
  slug: "about" | "privacy" | "terms" | "help";
  children: React.ReactNode;
}) {
  return (
    <a href={buildStaticHash(slug)} className="hover:text-ink">
      {children}
    </a>
  );
}

// AppRoute — the actual tool: input form + progress + history list.
// Was HomeRoute before the landing page was added; functionally unchanged.
function AppRoute() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
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
        <ErrorPanel
          error={phase.error}
          lastProgress={phase.lastProgress}
          onSuggestionClick={handleSuggestionClick}
        />
      )}

      {phase.kind === "loading" && (
        <div className="mt-6 space-y-4">
          <ClaimInput onSubmit={() => undefined} busy={true} />
          <ProgressIndicator current={phase.progress} />
        </div>
      )}

      <section className="mt-12">
        <SectionHeader number="02" label="Recent Dossiers" />
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
      <div className="mt-6 border border-stone-400 bg-stone-100 p-5">
        <p className="pf-label-loud">
          {error.status === "too_vague" ? "Claim too vague" : "Not a factual claim"}
        </p>
        <p className="mt-2 font-serif text-sm leading-relaxed text-stone-800">{error.reason}</p>
        {error.suggestions.length > 0 && (
          <>
            <p className="pf-label mt-5">Try one of these instead</p>
            <ul className="mt-2 space-y-1.5">
              {error.suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => onSuggestionClick(s)}
                    className="block w-full border border-stone-300 bg-white px-3 py-2 text-left font-sans text-sm text-stone-900 hover:border-ink hover:bg-stone-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {error.requestId && (
          <p className="mt-4 pf-mono text-stone-500">REQ: {error.requestId}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 border border-oxblood bg-stone-100 p-5">
      <p className="font-display text-xs font-bold uppercase tracking-widest text-oxblood">
        Pipeline failure
      </p>
      <p className="mt-2 font-sans text-sm text-stone-900">{error.message}</p>
      {lastProgress && (
        <p className="mt-3 pf-mono text-stone-700">
          FAILED AT — {PROGRESS_STEP_LABELS[lastProgress.step].toUpperCase()}
          {lastProgress.sublabel && ` (${lastProgress.sublabel})`}
        </p>
      )}
      {error.requestId && (
        <p className="mt-1 pf-mono text-stone-500">REQ: {error.requestId}</p>
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
      {/* Back link goes to the app, not the landing page — coming back from a
          dossier almost always means "submit another claim", not "re-read the
          marketing copy". Visitors arriving via shared permalinks can still
          reach the landing page via the wordmark. */}
      <a
        href={APP_HASH}
        className="mb-6 inline-block font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
      >
        ← Index
      </a>
      {state.kind === "loading" && (
        <p className="font-mono text-sm text-stone-600">Loading dossier…</p>
      )}
      {state.kind === "error" && (
        <div className="border border-oxblood bg-stone-100 p-4">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-oxblood">
            Couldn't load dossier
          </p>
          <p className="mt-2 font-sans text-sm text-stone-900">{state.message}</p>
        </div>
      )}
      {state.kind === "ready" && <DossierView dossier={state.dossier} />}
    </>
  );
}

// Reusable numbered-section header used across app + dossier + static views.
export function SectionHeader({ number, label }: { number: string; label: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      <span className="font-mono text-xs text-stone-500">{number}</span>
      <span className="pf-label-loud">{label}</span>
      <span className="h-px flex-1 bg-stone-300" />
    </div>
  );
}
