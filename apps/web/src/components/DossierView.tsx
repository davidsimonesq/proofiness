import { useEffect, useState } from "react";
import type { Dossier } from "@proofiness/shared-types";
import { SubClaimCard } from "./SubClaimCard.js";
import { CruxSummary } from "./CruxSummary.js";
import { TopLineAssessment } from "./TopLineAssessment.js";
import { ShareButton } from "./ShareButton.js";
import { DeleteDossierButton } from "./DeleteDossierButton.js";
import { SectionHeader } from "../App.js";

interface Props {
  dossier: Dossier;
}

// Format the per-instance sequential number with 3-digit zero-padding so it
// reads "DOSSIER · 007" — same shape as the history-list row labels for
// visual consistency. Falls back to "—" only if a dossier somehow reached
// the UI without being persisted (shouldn't happen in normal flow).
function fmtNumber(n: number | undefined): string {
  return typeof n === "number" ? String(n).padStart(3, "0") : "—";
}

export function DossierView({ dossier }: Props) {
  const cruxSet = new Set(dossier.crux?.hingesOn ?? []);
  const generatedDate = new Date(dossier.createdAt);
  // Fast-path / deep-path split. Default: top-line answer + limits visible.
  // The user clicks once to expand the case file (decomposition + assumptions
  // + unresolved questions). Stays in-page; no separate route.
  const [showFull, setShowFull] = useState(false);

  // Print support: when the user invokes Cmd-P, expand the deep path so the
  // full dossier prints, and force any <details> elements (LabelLegend,
  // LimitsDisclosure) open. The print stylesheet handles the rest.
  useEffect(() => {
    function onBeforePrint() {
      setShowFull(true);
      document.querySelectorAll("details").forEach((d) => {
        d.open = true;
      });
    }
    window.addEventListener("beforeprint", onBeforePrint);
    return () => window.removeEventListener("beforeprint", onBeforePrint);
  }, []);

  return (
    <article className="space-y-10">
      {/* Document header — case-file masthead */}
      <header className="border border-stone-400 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-300 bg-stone-100 px-4 py-2">
          <span className="pf-label-loud">Assessment · {fmtNumber(dossier.number)}</span>
          <div className="flex items-center gap-3">
            {dossier.canDelete && <DeleteDossierButton dossierId={dossier.id} />}
            <ShareButton dossierId={dossier.id} />
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="pf-label">Factual claim</p>
            <p className="mt-2 font-serif text-base leading-relaxed text-ink">{dossier.claim}</p>
          </div>
          {dossier.context && (
            <div>
              <p className="pf-label">Context (provided by user)</p>
              <p className="mt-2 font-serif text-sm leading-relaxed text-stone-800">{dossier.context}</p>
            </div>
          )}
          <div className="border-t border-stone-300 pt-3">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[0.7rem] uppercase tracking-widish text-stone-600 sm:grid-cols-4">
              <Meta term="Generated" value={generatedDate.toLocaleDateString()} />
              <Meta term="Time" value={generatedDate.toLocaleTimeString()} />
              <Meta term="Sub-claims" value={String(dossier.subClaims.length)} />
              <Meta
                term="Hinges"
                value={
                  dossier.crux?.hingesOn.length
                    ? String(dossier.crux.hingesOn.length)
                    : "—"
                }
              />
            </dl>
          </div>
        </div>
      </header>

      {/* FAST PATH — visible by default. The 30-second answer. */}
      {dossier.assessment && <TopLineAssessment assessment={dossier.assessment} />}

      {dossier.crux && <CruxSummary crux={dossier.crux} subClaims={dossier.subClaims} />}

      {/* DEEP PATH — opt-in. The 5-minute case file. */}
      {!showFull ? (
        <button
          type="button"
          onClick={() => setShowFull(true)}
          className="w-full border border-ink bg-white px-4 py-3 font-display text-sm font-semibold uppercase tracking-widish text-ink hover:bg-stone-100"
        >
          ↓ View full dossier: &nbsp;{dossier.subClaims.length} sub-claim
          {dossier.subClaims.length === 1 ? "" : "s"}, sources, steelman pairs, provenance
        </button>
      ) : (
        <>
          <LabelLegend />

          <section>
            <SectionHeader
              number="03"
              label={`Decomposition · ${dossier.subClaims.length} sub-claim${dossier.subClaims.length === 1 ? "" : "s"}`}
            />
            <div className="space-y-5">
              {dossier.subClaims.map((sc, i) => (
                <SubClaimCard
                  key={sc.id}
                  subClaim={sc}
                  isCrux={cruxSet.has(sc.id)}
                  index={i + 1}
                />
              ))}
            </div>
          </section>

          {dossier.embeddedAssumptions.length > 0 && (
            <section>
              <SectionHeader number="04" label="Embedded assumptions" />
              <ul className="border border-stone-300 bg-white">
                {dossier.embeddedAssumptions.map((a, i) => (
                  <li
                    key={i}
                    className="flex gap-3 border-b border-stone-200 px-4 py-3 last:border-b-0"
                  >
                    <span className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                      A·{String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="font-serif text-sm leading-relaxed text-stone-800">{a}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {dossier.unresolvedQuestions.length > 0 && (
            <section>
              <SectionHeader number="05" label="Unresolved questions" />
              <ul className="border border-stone-300 bg-white">
                {dossier.unresolvedQuestions.map((q, i) => (
                  <li
                    key={i}
                    className="flex gap-3 border-b border-stone-200 px-4 py-3 last:border-b-0"
                  >
                    <span className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                      Q·{String(i + 1).padStart(2, "0")}
                    </span>
                    <p className="font-serif text-sm leading-relaxed text-stone-800">{q}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button
            type="button"
            onClick={() => setShowFull(false)}
            className="w-full border border-stone-400 bg-white px-4 py-2 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink hover:text-ink"
          >
            ↑ Collapse dossier
          </button>
        </>
      )}
    </article>
  );
}

function Meta({ term, value }: { term: string; value: string }) {
  return (
    <div className="text-center">
      <dt className="text-stone-500">{term}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

// Reference key for the deep-path labels. Collapsed by default — first-time
// readers expand it once, then it stays out of the way. Same <details>
// pattern as LimitsDisclosure for visual continuity.
function LabelLegend() {
  return (
    <details className="border border-stone-300 bg-stone-50">
      <summary className="cursor-pointer px-4 py-2 font-display text-xs font-semibold uppercase tracking-widish text-accent hover:bg-stone-100">
        ⓘ &nbsp; How to read the labels in this dossier
      </summary>
      <dl className="grid gap-x-6 gap-y-3 border-t border-stone-300 p-4 font-serif text-sm leading-relaxed text-stone-800 sm:grid-cols-[max-content_1fr]">
        <dt className="font-mono text-xs uppercase tracking-widish text-stone-600">§NN·NN</dt>
        <dd>
          <strong>Sub-claim.</strong> The composite reads as <em>section·item</em> — e.g.{" "}
          <span className="font-mono text-xs">§03·01</span> is the first sub-claim under
          section 03 (Decomposition).
        </dd>

        <dt className="font-mono text-xs uppercase tracking-widish text-stone-600">S·NN</dt>
        <dd>
          <strong>Source.</strong> A retrieved article, paper, or page used as evidence
          for the surrounding sub-claim.
        </dd>

        <dt className="font-mono text-xs uppercase tracking-widish text-stone-600">H·NN</dt>
        <dd>
          <strong>Hop in a provenance chain.</strong> A citation step from secondary
          reporting toward a primary source.
        </dd>

        <dt className="font-mono text-xs uppercase tracking-widish text-stone-600">A·NN</dt>
        <dd>
          <strong>Embedded assumption.</strong> A claim the original input takes for
          granted that the dossier did not investigate.
        </dd>

        <dt className="font-mono text-xs uppercase tracking-widish text-stone-600">Q·NN</dt>
        <dd>
          <strong>Unresolved question.</strong> Something the dossier flagged but
          couldn't answer from the available sources.
        </dd>
      </dl>
    </details>
  );
}
