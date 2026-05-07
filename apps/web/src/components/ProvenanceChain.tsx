import { useState } from "react";
import type { ProvenanceChain as ProvenanceChainType, ProvenanceLink, TerminusReason } from "@crux/shared-types";
import { SourceQualityBadge } from "./SourceQualityBadge.js";

interface Props {
  chain: ProvenanceChainType;
  // Title of the root source — anchor of the visual chain.
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
  inferred_searched: "Named in prose, search-resolved",
  linked_inferred: "Linked from parent and named in prose",
};

// Renders the provenance chain as a visual list with arrows. Collapsed by default.
// No green/red — terminus is a textual indicator, not a verdict signal.
export function ProvenanceChain({ chain, rootTitle }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hopCount = chain.links.length;
  const terminusLabel = TERMINUS_LABELS[chain.terminusReason];

  // Show a one-line summary even when collapsed so the user can see whether
  // the trace went anywhere without expanding.
  const summary =
    hopCount === 0
      ? terminusLabel.toLowerCase()
      : `${hopCount} hop${hopCount === 1 ? "" : "s"} → ${terminusLabel.toLowerCase()}`;

  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs hover:bg-slate-100"
        aria-expanded={expanded}
      >
        <span>
          <span className="font-semibold uppercase tracking-wide text-slate-700">Provenance:</span>{" "}
          <span className="text-slate-600">{summary}</span>
        </span>
        <span className="text-slate-400" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-slate-200 px-3 py-3 text-sm">
          <div className="text-xs italic text-slate-600">
            {hopCount === 0
              ? terminusLabel
              : "Tracing citations upstream from the source. Each step shows what the previous one cites."}
          </div>

          <ol className="space-y-2">
            {/* Root */}
            <li className="rounded border border-slate-200 bg-white p-2">
              <div className="text-xs uppercase tracking-wide text-slate-500">Root source</div>
              <div className="text-sm text-slate-800">{rootTitle}</div>
            </li>

            {chain.links.map((link, i) => (
              <li key={`${link.url}-${i}`} className="space-y-1">
                <div className="ml-2 text-xs text-slate-400">↓ cites</div>
                <div className="rounded border border-slate-200 bg-white p-2">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700"
                    >
                      {link.title}
                    </a>
                    <SourceQualityBadge
                      sourceType={link.sourceType}
                      classifierUsed={link.classifierUsed}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span title={RESOLUTION_LABELS[link.resolutionMethod]}>
                      {RESOLUTION_LABELS[link.resolutionMethod]}
                    </span>
                    {link.publishedAt && <span>{formatDate(link.publishedAt)}</span>}
                    {link.paywalled && <span>paywalled</span>}
                    {link.fetchError && !link.paywalled && (
                      <span title={link.fetchError}>couldn't fetch full text</span>
                    )}
                  </div>
                  {link.citationContext && (
                    <p className="mt-1 text-xs italic text-slate-600">
                      "{link.citationContext.length > 280 ? `${link.citationContext.slice(0, 280)}…` : link.citationContext}"
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="border-t border-slate-200 pt-2 text-xs text-slate-600">
            <span className="font-medium">Terminus:</span> {terminusLabel}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
