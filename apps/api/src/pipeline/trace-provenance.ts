// Provenance tracer — Phase 4 MVP.
//
// Given a source (typically secondary_reporting), follow citations upstream
// up to MAX_DEPTH hops, returning a linear chain of where each level points.
// Stops when:
//   - we reach a primary source (primary_research / peer_reviewed / government)
//   - we hit the depth limit
//   - the article has no extractable citations
//   - all candidates fail to resolve or fetch
//
// Spec §3.5 promises "many widely-repeated 'facts' trace back to a single
// original source that has been retracted, misinterpreted, or was always weak."
// This module is what makes that visible.

import type { ProvenanceChain, ProvenanceLink, SourceType, TerminusReason } from "@crux/shared-types";
import { getCachedFetch, provenanceCache } from "../lib/cache.js";
import { fromOutboundLinks, inferFromProse, mergeCandidates, type CitationCandidate } from "./extract-citations.js";
import { classifyOne } from "./classify.js";
import { getSearchProvider } from "../lib/search-provider.js";
import { classifyByDomain } from "../lib/source-rules.js";
import type { FetchResult } from "./fetch.js";

const MAX_DEPTH = 2;
// How many candidates we'll attempt per hop before giving up.
const MAX_CANDIDATES_PER_HOP = 3;

const PRIMARY_TYPES: ReadonlySet<SourceType> = new Set([
  "primary_research",
  "peer_reviewed",
  "government",
]);

// Source types worth tracing AT ALL. Skip primary types (already at headwater),
// social_media (citation graph means little), and aggregators (lateral).
const TRACEABLE_TYPES: ReadonlySet<SourceType> = new Set(["secondary_reporting"]);

interface RootInput {
  url: string;
  sourceType: SourceType;
  fetchResult?: FetchResult;
}

export function isTraceable(sourceType: SourceType, paywalled: boolean | undefined, fetchError: string | undefined): boolean {
  if (!TRACEABLE_TYPES.has(sourceType)) return false;
  // Can't extract citations from a page we couldn't fetch or that was gated.
  if (paywalled) return false;
  if (fetchError) return false;
  return true;
}

export async function traceProvenance(root: RootInput): Promise<ProvenanceChain> {
  const cached = provenanceCache.get(root.url);
  if (cached) return cached;

  const result = await traceRecursive(root, MAX_DEPTH, new Set([normalizeUrl(root.url)]));
  provenanceCache.set(root.url, result);
  return result;
}

interface CurrentLevel {
  url: string;
  sourceType: SourceType;
  fetchResult?: FetchResult;
}

async function traceRecursive(
  current: CurrentLevel,
  hopsRemaining: number,
  visited: Set<string>,
): Promise<ProvenanceChain> {
  if (hopsRemaining <= 0) {
    return { links: [], terminusReason: "depth_limit" };
  }

  // Resolve the current level's fetch result (use the one we were given when
  // possible — assemble-dossier already fetched it).
  let fetched = current.fetchResult;
  if (!fetched) {
    try {
      fetched = await getCachedFetch(current.url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[provenance] fetch failed for ${current.url}: ${msg}`);
      return { links: [], terminusReason: "trace_failed" };
    }
  }

  if (!fetched.fullText && (!fetched.outboundLinks || fetched.outboundLinks.length === 0)) {
    return { links: [], terminusReason: "no_citations_found" };
  }

  // Extract candidates: links + LLM inference, then merge.
  const linked = fromOutboundLinks(fetched.outboundLinks ?? []);
  const inferred = await inferFromProse(fetched.fullText ?? "");
  const merged = mergeCandidates(linked, inferred);
  if (merged.length === 0) {
    return { links: [], terminusReason: "no_citations_found" };
  }

  const ranked = rankCandidates(merged);

  // Try candidates in rank order until one resolves + fetches successfully.
  for (let i = 0; i < Math.min(ranked.length, MAX_CANDIDATES_PER_HOP); i++) {
    const cand = ranked[i]!;

    let resolvedUrl: string | null;
    if (cand.url) {
      resolvedUrl = cand.url;
    } else {
      resolvedUrl = await resolveViaSearch(cand.searchQuery);
      if (!resolvedUrl) continue;
    }

    const norm = normalizeUrl(resolvedUrl);
    if (visited.has(norm)) continue; // Don't loop back to a source already in the chain.
    visited.add(norm);

    let childFetch: FetchResult;
    try {
      childFetch = await getCachedFetch(resolvedUrl);
    } catch {
      continue;
    }
    if (childFetch.fetchError && !childFetch.fullText) {
      continue;
    }

    // Classify the new link.
    const cls = await classifyOne({
      url: resolvedUrl,
      title: cand.label,
      snippet: childFetch.fullText?.slice(0, 400) ?? cand.context ?? "",
    });

    const link: ProvenanceLink = {
      url: resolvedUrl,
      title: cand.label,
      sourceType: cls.type,
      classifierUsed: cls.classifierUsed,
      publishedAt: childFetch.publishedAt,
      paywalled: childFetch.paywalled,
      fetchError: childFetch.fetchError,
      resolutionMethod: cand.resolutionMethod,
      citationContext: cand.context,
    };

    // Terminus check: did we land on primary?
    if (PRIMARY_TYPES.has(cls.type)) {
      return { links: [link], terminusReason: "primary_source_reached" };
    }
    // Otherwise recurse — what does THIS source cite?
    if (hopsRemaining - 1 <= 0) {
      return { links: [link], terminusReason: "depth_limit" };
    }
    const childChain = await traceRecursive(
      { url: resolvedUrl, sourceType: cls.type, fetchResult: childFetch },
      hopsRemaining - 1,
      visited,
    );
    return {
      links: [link, ...childChain.links],
      terminusReason: childChain.terminusReason,
    };
  }

  // All candidates failed.
  return { links: [], terminusReason: "dead_end" };
}

// Higher number = better candidate. Linked + inferred wins (high confidence
// match). Linked-only beats inferred-only because we save a search. Within ties,
// candidates whose URL hits a "primary-looking" domain rule rank first — those
// are most likely to terminate the chain quickly.
function rankCandidates(candidates: CitationCandidate[]): CitationCandidate[] {
  return [...candidates].sort((a, b) => scoreOf(b) - scoreOf(a));
}

function scoreOf(c: CitationCandidate): number {
  let score = 0;
  if (c.resolutionMethod === "linked_inferred") score += 100;
  else if (c.resolutionMethod === "linked") score += 50;
  // inferred_searched gets +0

  // Bias toward URLs that look like primary sources. classifyByDomain returns
  // a SourceType for known domains; we add a bonus when it's a primary type.
  if (c.url) {
    const ruleType = classifyByDomain(c.url);
    if (ruleType && PRIMARY_TYPES.has(ruleType)) score += 30;
    if (ruleType === "secondary_reporting") score += 5; // still useful, but not headwater
  }
  return score;
}

async function resolveViaSearch(query: string): Promise<string | null> {
  if (!query.trim()) return null;
  try {
    const provider = getSearchProvider();
    const hits = await provider.search(query, { maxResults: 1 });
    return hits[0]?.url ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[provenance] search resolution failed for ${JSON.stringify(query)}: ${msg}`);
    return null;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
