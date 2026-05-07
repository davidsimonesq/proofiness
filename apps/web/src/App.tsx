import { useEffect, useState } from "react";
import type { Dossier, ProgressEvent } from "@crux/shared-types";
import { ClaimInput } from "./components/ClaimInput.js";
import { DossierView } from "./components/DossierView.js";
import { ProgressIndicator } from "./components/ProgressIndicator.js";
import { HistoryList } from "./components/HistoryList.js";
import { getDossier, streamDossier } from "./lib/api.js";
import { buildDossierHash, navigate, useRoute } from "./lib/route.js";

type Phase =
  | { kind: "idle" }
  | { kind: "loading"; progress: ProgressEvent | null }
  | { kind: "error"; message: string }
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

  async function handleSubmit(claim: string, context: string | undefined) {
    setPhase({ kind: "loading", progress: null });
    await streamDossier(
      { claim, context },
      {
        onProgress: (event) => setPhase({ kind: "loading", progress: event }),
        onDone: (dossier) => {
          // Navigate to the dossier's permalink so refresh + share work.
          navigate(buildDossierHash(dossier.id));
        },
        onError: (message) => setPhase({ kind: "error", message }),
      },
    );
  }

  return (
    <>
      {(phase.kind === "idle" || phase.kind === "error") && (
        <ClaimInput onSubmit={handleSubmit} busy={false} />
      )}

      {phase.kind === "error" && (
        <div className="mt-6 rounded border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-1">{phase.message}</p>
        </div>
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
