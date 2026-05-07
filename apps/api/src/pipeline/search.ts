import type { SearchHit } from "../lib/search-provider.js";
import { getSearchProvider } from "../lib/search-provider.js";

const TOP_N_PER_SUBCLAIM = 3;

export async function searchForSubClaim(query: string): Promise<SearchHit[]> {
  if (!query.trim()) return [];
  const provider = getSearchProvider();
  try {
    return await provider.search(query, { maxResults: TOP_N_PER_SUBCLAIM });
  } catch (err) {
    // Phase 1: degrade per-sub-claim instead of failing the whole dossier.
    // Surface as an empty-source sub-claim; the UI will show "no sources found".
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[search] failed for query ${JSON.stringify(query)}: ${msg}`);
    return [];
  }
}
