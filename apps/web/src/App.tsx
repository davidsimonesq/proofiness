import { useEffect, useRef, useState } from "react";
import type { Dossier, ProgressEvent, ProgressStep } from "@proofiness/shared-types";
import { ClaimInput } from "./components/ClaimInput.js";
import { DossierView } from "./components/DossierView.js";
import { LimitsDisclosure } from "./components/LimitsDisclosure.js";
import { ProgressIndicator } from "./components/ProgressIndicator.js";
import { HistoryList } from "./components/HistoryList.js";
import { StaticPage } from "./components/StaticPage.js";
import { LandingPage } from "./components/LandingPage.js";
import { SettingsPage } from "./components/SettingsPage.js";
import { InviteCodeGate } from "./components/InviteCodeGate.js";
import { RequestInviteForm } from "./components/RequestInviteForm.js";
import { getDossier, streamDossier, type DossierError } from "./lib/api.js";
import { getInviteCode } from "./lib/invites.js";
import { hasFullByokKeys } from "./lib/keys.js";
import { consumePendingClaim } from "./lib/pending-claim.js";
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
    case "settings":
      return <SettingsPage />;
    case "request-invite":
      return <RequestInviteForm />;
    case "unknown":
    default:
      return <LandingPage />;
  }
}

function Header({ route }: { route: Route }) {
  // "Open the App" CTA visible on landing and static pages — places where the
  // user might be reading and want to get to the tool without scrolling. Hidden
  // on app and dossier views (they're already in the tool). When there's
  // nothing to show in the top bar, the bar itself is omitted so the wordmark
  // + tagline carry the document-genre signal alone.
  const showAppLink =
    route.kind === "landing" || route.kind === "static" || route.kind === "settings";
  return (
    <header className="mb-8 sm:mb-12">
      {showAppLink && (
        <div className="mb-4 flex items-center justify-end">
          <a
            href={APP_HASH}
            className="font-display text-xs font-semibold uppercase tracking-widish text-ink hover:text-accent"
          >
            Open the App →
          </a>
        </div>
      )}
      <div className="pf-rule" />
      <div className="flex items-end justify-between gap-4 pt-3">
        <a href="#/" className="block">
          <h1 className="font-display text-4xl font-bold uppercase tracking-widish text-ink sm:text-5xl">
            Proofiness
          </h1>
          <p className="mt-1 font-serif text-lg italic text-stone-600">
            A Quest for Truth — with Receipts!
          </p>
        </a>
      </div>
      {route.kind === "landing" && (
        <p className="mt-4 max-w-prose font-serif text-[1.05rem] leading-relaxed text-stone-700">
          Enter a factual claim you want to assess. Proofiness will decompose it into multiple sub-claims, trace citations to their headwater, steelman both sides of the claim, and return a carefully calibrated assessment backed by a full dossier.
        </p>
      )}
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
        <a href="#/settings" className="hover:text-ink">
          Settings
        </a>
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
function AppRoute() {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // Bumped on successful invite-code entry to force a re-render of the gate.
  const [inviteVersion, setInviteVersion] = useState(0);
  // Seeds ClaimInput on mount. Set by the auto-mint handoff and by every
  // submit, so the loading-state textarea always shows what's being verified.
  const [seedClaim, setSeedClaim] = useState<string>("");
  const lastProgressRef = useRef<ProgressEvent | null>(null);

  async function handleSubmit(claim: string, context: string | undefined) {
    setSeedClaim(claim);
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

  // Handoff from the request-invite flow: if the user just minted a code and
  // asked us to start the dossier on the same claim, sessionStorage holds the
  // normalized claim. Consume + auto-submit on mount. consumePendingClaim
  // clears the slot so a refresh doesn't re-trigger the auto-submit.
  useEffect(() => {
    const pending = consumePendingClaim();
    if (pending) {
      void handleSubmit(pending, undefined);
    }
    // intentional: run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSuggestionClick(suggestion: string) {
    handleSubmit(suggestion, undefined);
  }

  // BYOK takes precedence over the invite gate. When the user has both
  // personal keys saved, the server bypasses the cost gate entirely and the
  // invite gate is irrelevant; we show a status badge linking to Settings so
  // they can confirm what's active.
  const usingByok = hasFullByokKeys();
  const hasCode = getInviteCode() !== null;
  const inviteError = phase.kind === "error" && phase.error.kind === "invite_required" ? phase.error.reason : null;
  const showGate = !usingByok && (!hasCode || inviteError !== null);

  if (showGate) {
    return (
      <InviteCodeGate
        key={inviteVersion}
        reason={inviteError ?? undefined}
        onAccepted={() => {
          setInviteVersion((v) => v + 1);
          setPhase({ kind: "idle" });
        }}
      />
    );
  }

  return (
    <>
      {usingByok && <ByokBadge />}

      {(phase.kind === "idle" || phase.kind === "error") && (
        <div className="space-y-4">
          {/* <LimitsDisclosure />  -- temporarily hidden; uncomment to restore */}
          <ClaimInput onSubmit={handleSubmit} busy={false} initialClaim={seedClaim} />
        </div>
      )}

      {phase.kind === "error" && phase.error.kind !== "invite_required" && (
        <ErrorPanel
          error={phase.error}
          lastProgress={phase.lastProgress}
          onSuggestionClick={handleSuggestionClick}
        />
      )}

      {phase.kind === "loading" && (
        <div className="mt-6 space-y-4">
          <ClaimInput onSubmit={() => undefined} busy={true} initialClaim={seedClaim} />
          <ProgressIndicator current={phase.progress} />
        </div>
      )}

      <section className="mt-12">
        <SectionHeader label="Recent Assessments" />
        <HistoryList />
      </section>
    </>
  );
}

// Small status pill shown above the input form when the user has set personal
// API keys. Confirms BYOK is active and links to Settings for management.
function ByokBadge() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border border-accent-dim bg-stone-50 px-3 py-2">
      <span className="font-display text-xs font-bold uppercase tracking-widish text-accent">
        BYOK active — using your keys
      </span>
      <a
        href="#/settings"
        className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-700 hover:text-ink"
      >
        Manage →
      </a>
    </div>
  );
}

interface ErrorPanelProps {
  error: DossierError;
  lastProgress: ProgressEvent | null;
  onSuggestionClick: (suggestion: string) => void;
}

function ErrorPanel({ error, lastProgress, onSuggestionClick }: ErrorPanelProps) {
  if (error.kind === "quota_exceeded") {
    return (
      <div className="mt-6 border border-stone-400 bg-stone-100 p-5">
        <p className="pf-label-loud">Invite quota exhausted</p>
        <p className="mt-2 font-serif text-sm leading-relaxed text-stone-800">{error.reason}</p>
        <p className="mt-2 font-serif text-xs italic text-stone-600">
          Each invite code allows for a limited number of assessments. Switch to your own
          API keys for unlimited assessments. You'll be billed directly by Anthropic and Tavily.
        </p>
        <a
          href="#/settings"
          className="mt-3 inline-block border border-ink bg-ink px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800"
        >
          Use my own keys →
        </a>
      </div>
    );
  }
  if (error.kind === "invite_required") {
    // Surfaced by the gate above the form; this branch shouldn't render.
    return null;
  }
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
      {/* Back link goes to the app, not the landing page — coming back from an
          assessment almost always means "submit another claim", not "re-read the
          marketing copy". Visitors arriving via shared permalinks can still
          reach the landing page via the wordmark. */}
      <a
        href={APP_HASH}
        className="mb-6 inline-block font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
      >
        ← Home
      </a>
      {state.kind === "loading" && (
        <p className="font-mono text-sm text-stone-600">Loading assessment…</p>
      )}
      {state.kind === "error" && (
        <div className="border border-oxblood bg-stone-100 p-4">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-oxblood">
            Couldn't load assessment
          </p>
          <p className="mt-2 font-sans text-sm text-stone-900">{state.message}</p>
        </div>
      )}
      {state.kind === "ready" && <DossierView dossier={state.dossier} />}
    </>
  );
}

// Reusable section header used across app + dossier + static views. The
// `number` slot is optional — pages that have a meaningful sequence (the
// landing page, the deep dossier view) use it; standalone sections omit it
// so an orphan "02" doesn't appear without a preceding "01".
export function SectionHeader({ number, label }: { number?: string; label: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-3">
      {number && <span className="font-mono text-xs text-stone-500">{number}</span>}
      <span className="pf-label-loud">{label}</span>
      <span className="h-px flex-1 bg-stone-300" />
    </div>
  );
}
