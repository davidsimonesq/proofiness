// In-memory LRU caches for Phase 2+.
//
// Spec §5: "Heavy caching of fetched sources to control cost and respect publishers."
// In-memory is fine for single-instance dev. When we add Postgres in a later
// phase, swap these for a persistent layer keyed the same way.

import { LRUCache } from "lru-cache";
import { fetchAndExtract, type FetchResult } from "../pipeline/fetch.js";
import type { Classification } from "../pipeline/classify.js";
import type { ProvenanceChain } from "@crux/shared-types";

// Article content can change but rarely matters for fact-checking; cache an hour.
export const fetchCache = new LRUCache<string, FetchResult>({
  max: 1000,
  ttl: 60 * 60 * 1000, // 1 hour
});

// Classifications change essentially never — cache for a day.
// Keyed by URL, not by full classify input — title/snippet variation across
// searches doesn't change what kind of source the URL is.
export const classifyCache = new LRUCache<string, Classification["type"]>({
  max: 5000,
  ttl: 24 * 60 * 60 * 1000, // 24 hours
});

// Provenance chains are expensive to compute (multiple LLM + search + fetch
// calls per chain). Cache by root URL for an hour — same TTL as fetch since
// chains depend on article content.
export const provenanceCache = new LRUCache<string, ProvenanceChain>({
  max: 1000,
  ttl: 60 * 60 * 1000,
});

// Single-arg cache wrapper around fetch — used everywhere a URL needs to be
// fetched + extracted. Hoisted here so assemble-dossier and trace-provenance
// share one implementation (and one cache).
export async function getCachedFetch(url: string): Promise<FetchResult> {
  const cached = fetchCache.get(url);
  if (cached) return cached;
  const result = await fetchAndExtract(url);
  fetchCache.set(url, result);
  return result;
}
