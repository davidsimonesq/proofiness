import type { ClaimType, SubClaim } from "@crux/shared-types";
import { SourceQualityBadge } from "./SourceQualityBadge.js";
import { SteelmanPair } from "./SteelmanPair.js";
import { ProvenanceChain } from "./ProvenanceChain.js";
import { ContestationBadge } from "./ContestationBadge.js";

const TYPE_LABELS: Record<ClaimType, string> = {
  empirical_fact: "Empirical fact",
  causal: "Causal claim",
  definitional: "Definitional",
  value_judgment: "Value judgment",
  prediction: "Prediction",
  comparative: "Comparative",
};

// Visual style differs by type so the user can see at a glance what KIND of claim
// each piece is — empirical questions need different evidence than value questions.
// Border-color only; no fill that suggests a verdict.
const TYPE_BORDER: Record<ClaimType, string> = {
  empirical_fact: "border-l-blue-500",
  causal: "border-l-purple-500",
  definitional: "border-l-amber-500",
  value_judgment: "border-l-rose-500",
  prediction: "border-l-teal-500",
  comparative: "border-l-indigo-500",
};

interface Props {
  subClaim: SubClaim;
  // Marked when the dossier-level crux identifies this sub-claim as a hinge.
  isCrux?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SubClaimCard({ subClaim, isCrux }: Props) {
  // Crux marker: a thin ring around the card. Visually neutral — same slate tone
  // as everywhere else, no green/red. The text label below carries the meaning.
  const cruxRing = isCrux ? "ring-2 ring-slate-700 ring-offset-1" : "";
  return (
    <article
      className={`rounded border border-slate-200 ${TYPE_BORDER[subClaim.type]} border-l-4 bg-white p-4 shadow-sm ${cruxRing}`}
    >
      {isCrux && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-700">
          Crux sub-claim — the overall claim hinges on this
        </p>
      )}

      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{subClaim.text}</h3>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {subClaim.contestation && (
            <ContestationBadge label={subClaim.contestation.label} />
          )}
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {TYPE_LABELS[subClaim.type]}
          </span>
        </div>
      </header>

      {subClaim.contestation?.note && (
        <p className="mb-2 text-xs italic text-slate-600">{subClaim.contestation.note}</p>
      )}

      {subClaim.searchQueries.length > 0 && (
        <details className="mb-2 text-xs text-slate-500">
          <summary className="cursor-pointer">
            Searched: {subClaim.searchQueries.length}{" "}
            {subClaim.searchQueries.length === 1 ? "framing" : "framings"}
          </summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {subClaim.searchQueries.map((q, i) => (
              <li key={i} className="font-mono">
                {q}
              </li>
            ))}
          </ul>
        </details>
      )}

      {subClaim.sources.length === 0 ? (
        <p className="text-sm italic text-slate-500">
          {subClaim.searchQueries.length > 0
            ? "No sources returned for this sub-claim across all framings."
            : "Not searchable — this sub-claim is not the kind of question evidence resolves."}
        </p>
      ) : (
        <ul className="space-y-3">
          {subClaim.sources.map((src, i) => (
            <li key={`${src.url}-${i}`} className="rounded border border-slate-100 bg-slate-50 p-3">
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700"
                >
                  {src.title}
                </a>
                <SourceQualityBadge
                  sourceType={src.sourceType}
                  classifierUsed={src.classifierUsed}
                />
              </div>

              <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                {src.publishedAt && <span>{formatDate(src.publishedAt)}</span>}
                {src.paywalled && (
                  <span className="rounded border border-slate-300 px-1.5 py-0.5 font-medium text-slate-600">
                    Paywalled
                  </span>
                )}
                {src.fetchError && !src.paywalled && (
                  <span
                    className="rounded border border-slate-300 px-1.5 py-0.5 font-medium text-slate-600"
                    title={src.fetchError}
                  >
                    Couldn't fetch full text
                  </span>
                )}
              </div>

              {src.snippet && <p className="text-sm text-slate-700">{src.snippet}</p>}
              <p className="mt-1 truncate text-xs text-slate-400">{src.url}</p>
              {src.provenance && (
                <ProvenanceChain chain={src.provenance} rootTitle={src.title} />
              )}
            </li>
          ))}
        </ul>
      )}

      {subClaim.steelman && (
        <SteelmanPair
          steelman={subClaim.steelman}
          sources={subClaim.sources}
          subClaimId={subClaim.id}
        />
      )}
    </article>
  );
}
