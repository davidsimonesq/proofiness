import type { SearchHit } from "../lib/search-provider.js";
import { getSearchProvider } from "../lib/search-provider.js";

// Multi-framing search per spec §3.3: run multiple queries with varied framings
// (decompose chooses), in parallel, dedupe by URL. The framing variety is the
// confirmation-bias countermeasure — running 4 paraphrases of the same query
// would defeat the purpose, so we trust decompose to provide actually-varied
// framings (the prompt enforces this).

const RESULTS_PER_QUERY = 3;
const MAX_HITS_PER_SUBCLAIM = 6;

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

export async function searchForSubClaim(queries: string[]): Promise<SearchHit[]> {
  const validQueries = queries.map((q) => q.trim()).filter((q) => q.length > 0);
  if (validQueries.length === 0) return [];

  const provider = getSearchProvider();

  // Run all framings in parallel. Per-query failures degrade to empty rather
  // than poisoning the whole sub-claim — one bad framing shouldn't kill the rest.
  const allHits = await Promise.all(
    validQueries.map(async (query) => {
      try {
        return await provider.search(query, { maxResults: RESULTS_PER_QUERY });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[search] failed for query ${JSON.stringify(query)}: ${msg}`);
        return [] as SearchHit[];
      }
    }),
  );

  // Dedupe by normalized URL. Keep the first occurrence (which preserves the
  // order returned by the first framing that found the URL — usually the
  // neutral one, since decompose is instructed to emit it first).
  const seen = new Set<string>();
  const deduped: SearchHit[] = [];
  for (const hits of allHits) {
    for (const hit of hits) {
      const key = normalizeUrl(hit.url);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(hit);
      if (deduped.length >= MAX_HITS_PER_SUBCLAIM) return deduped;
    }
  }
  return deduped;
}
