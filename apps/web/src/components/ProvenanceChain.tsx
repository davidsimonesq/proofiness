import { useState } from "react";
import type {
  ProvenanceChain as ProvenanceChainType,
  ProvenanceLink,
  TerminusReason,
} from "@proofiness/shared-types";
import { SourceQualityBadge } from "./SourceQualityBadge.js";

interface Props {
  chain: ProvenanceChainType;
  rootTitle: string;
}

const TERMINUS_LABELS: Record<TerminusReason, string> = {
  primary_source_reached: "Reached a primary source",
  depth_limit: "Stopped at trace depth limit (more hops may exist)",
  no_citations_found: "No identifiable upstream citations",
  dead_end: "Citations existed but couldn't be resolved",
  trace_failed: "Trace failed",
};

const RESOLUTION_LABELS: Record<ProvenanceLink["resolutionMethod"], string> = {
  linked: "Linked from parent",
  inferred_searched: "Named in prose · search-resolved",
  linked_inferred: "Linked + named in prose",
};

export function ProvenanceChain({ chain, rootTitle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hopCount = chain.links.length;
  const terminusLabel = TERMINUS_LABELS[chain.terminusReason];

  const summary =
    hopCount === 0
      ? terminusLabel.toLowerCase()
      : `${hopCount} hop${hopCount === 1 ? "" : "s"} → ${terminusLabel.toLowerCase()}`;

  return (
    <div className="mt-3 border border-stone-300 bg-stone-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-stone-100"
        aria-expanded={expanded}
      >
        <span className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-700">
          <span className="font-bold text-ink">Provenance</span> · {summary}
        </span>
        <span className="font-mono text-xs text-stone-500" aria-hidden="true">
          {expanded ? "[ − ]" : "[ + ]"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-stone-300 px-3 py-3">
          <div className="font-serif text-xs italic leading-relaxed text-stone-700">
            {hopCount === 0
              ? terminusLabel
              : "Tracing citations upstream from the source. Each step shows what the previous one cites."}
          </div>

          <ol className="space-y-2">
            <ChainLink number="00" label="Root source" title={rootTitle} isRoot />

            {chain.links.map((link, i) => (
              <li key={`${link.url}-${i}`}>
                <div className="ml-3 my-1 font-mono text-xs text-stone-500">↓ cites</div>
                <div className="border border-stone-300 bg-white p-2.5">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="mr-2 font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                        H·{String(i + 1).padStart(2, "0")}
                      </span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-sans text-sm font-medium text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
                      >
                        {link.title}
                      </a>
                    </div>
                    <SourceQualityBadge
                      sourceType={link.sourceType}
                      classifierUsed={link.classifierUsed}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                    <span>{RESOLUTION_LABELS[link.resolutionMethod]}</span>
                    {link.publishedAt && <span>{formatDate(link.publishedAt)}</span>}
                    {link.paywalled && <span className="text-stone-700">paywalled</span>}
                    {link.fetchError && !link.paywalled && (
                      <span className="text-stone-700" title={link.fetchError}>
                        fetch failed
                      </span>
                    )}
                  </div>
                  {link.citationContext && (
                    <p className="mt-2 border-l-2 border-stone-300 bg-stone-50 px-2 py-1 font-serif text-xs italic leading-relaxed text-stone-700">
                      "
                      {link.citationContext.length > 280
                        ? `${link.citationContext.slice(0, 280)}…`
                        : link.citationContext}
                      "
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="border-t border-stone-300 pt-2 font-mono text-[0.7rem] uppercase tracking-widish text-stone-700">
            <span className="font-bold text-ink">Terminus</span> · {terminusLabel.toLowerCase()}
          </div>
        </div>
      )}
    </div>
  );
}

function ChainLink({
  number,
  label,
  title,
  isRoot,
}: {
  number: string;
  label: string;
  title: string;
  isRoot?: boolean;
}) {
  return (
    <li className={`border bg-white p-2.5 ${isRoot ? "border-ink" : "border-stone-300"}`}>
      <div className="mb-0.5 flex items-center gap-2">
        <span className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
          H·{number}
        </span>
        <span className="pf-label">{label}</span>
      </div>
      <p className="font-sans text-sm text-ink">{title}</p>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
