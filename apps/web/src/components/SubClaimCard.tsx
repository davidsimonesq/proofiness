import type { ClaimType, SubClaim } from "@proofiness/shared-types";
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

// Per-type left rule color. Stays in the cool-metal palette — no green/red,
// no fill that suggests a verdict. Different rules signal "different KIND of
// question" so the user can see what evidence to expect.
const TYPE_RULE: Record<ClaimType, string> = {
  empirical_fact: "border-l-stone-700",
  causal: "border-l-stone-600",
  definitional: "border-l-amber-700", // brass — definitional moves are the most-overlooked
  value_judgment: "border-l-stone-500",
  prediction: "border-l-stone-600",
  comparative: "border-l-stone-700",
};

interface Props {
  subClaim: SubClaim;
  index: number;
  isCrux?: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SubClaimCard({ subClaim, index, isCrux }: Props) {
  return (
    <article
      className={`border border-stone-300 ${TYPE_RULE[subClaim.type]} border-l-4 bg-white ${isCrux ? "ring-1 ring-accent ring-offset-2 ring-offset-stone-50" : ""}`}
    >
      {/* Section masthead with section number + type tag */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-300 bg-stone-100 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-600">
            §03·{String(index).padStart(2, "0")}
          </span>
          <span className="pf-label">{TYPE_LABELS[subClaim.type]}</span>
        </div>
        {subClaim.contestation && (
          <ContestationBadge label={subClaim.contestation.label} />
        )}
      </div>

      <div className="space-y-4 p-4">
        {isCrux && (
          <p className="border-l-2 border-accent bg-stone-50 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-widish text-accent">
            Crux · the overall claim hinges on this
          </p>
        )}

        <h3 className="font-serif text-base leading-relaxed text-ink">{subClaim.text}</h3>

        {subClaim.contestation?.note && (
          <p className="border-l-2 border-stone-300 bg-stone-50 px-3 py-2 font-serif text-xs italic leading-relaxed text-stone-700">
            {subClaim.contestation.note}
          </p>
        )}

        {subClaim.searchQueries.length > 0 && (
          <details className="border border-stone-200 bg-stone-50">
            <summary className="cursor-pointer px-3 py-1.5 font-mono text-[0.7rem] uppercase tracking-widish text-stone-600 hover:text-ink">
              Searched · {subClaim.searchQueries.length}{" "}
              {subClaim.searchQueries.length === 1 ? "framing" : "framings"}
            </summary>
            <ul className="space-y-0.5 border-t border-stone-200 px-3 py-2">
              {subClaim.searchQueries.map((q, i) => (
                <li key={i} className="font-mono text-xs text-stone-700">
                  → {q}
                </li>
              ))}
            </ul>
          </details>
        )}

        {subClaim.sources.length === 0 ? (
          <p className="font-serif text-sm italic text-stone-600">
            {subClaim.searchQueries.length > 0
              ? "No sources returned across all framings."
              : "Not searchable — this sub-claim is not the kind of question evidence resolves."}
          </p>
        ) : (
          <div>
            <p className="pf-label mb-2">
              Sources · {subClaim.sources.length}
            </p>
            <ul className="divide-y divide-stone-200 border border-stone-200">
              {subClaim.sources.map((src, i) => (
                <li key={`${src.url}-${i}`} className="bg-white p-3">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="mr-2 font-mono text-[0.7rem] text-stone-500">
                        S·{String(i + 1).padStart(2, "0")}
                      </span>
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-sm font-medium text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
                      >
                        {src.title}
                      </a>
                    </div>
                    <SourceQualityBadge
                      sourceType={src.sourceType}
                      classifierUsed={src.classifierUsed}
                    />
                  </div>

                  <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                    {src.publishedAt && <span>{formatDate(src.publishedAt)}</span>}
                    {src.paywalled && (
                      <span className="border border-stone-400 px-1.5 py-px text-stone-700">
                        Paywalled
                      </span>
                    )}
                    {src.fetchError && !src.paywalled && (
                      <span
                        className="border border-stone-400 px-1.5 py-px text-stone-700"
                        title={src.fetchError}
                      >
                        Fetch failed
                      </span>
                    )}
                  </div>

                  {src.snippet && (
                    <p className="font-serif text-sm leading-relaxed text-stone-800">
                      {src.snippet}
                    </p>
                  )}
                  <p className="mt-1 truncate font-mono text-[0.7rem] text-stone-500">{src.url}</p>
                  {src.provenance && (
                    <ProvenanceChain chain={src.provenance} rootTitle={src.title} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {subClaim.steelman && (
          <SteelmanPair
            steelman={subClaim.steelman}
            sources={subClaim.sources}
            subClaimId={subClaim.id}
          />
        )}
      </div>
    </article>
  );
}
