// Thin abstraction over the web-search API so swapping Tavily ↔ Brave ↔ Serper
// is a one-file change. Phase 1 ships with Tavily.

import { getRequestTavilyKey } from "./request-context.js";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  score?: number;
}

export interface SearchProvider {
  search(query: string, opts?: { maxResults?: number }): Promise<SearchHit[]>;
}

class TavilyProvider implements SearchProvider {
  constructor(private apiKey: string) {}

  async search(query: string, opts: { maxResults?: number } = {}): Promise<SearchHit[]> {
    const maxResults = opts.maxResults ?? 3;
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Tavily search failed (${res.status}): ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        published_date?: string;
        score?: number;
      }>;
    };
    return (data.results ?? []).map((r) => ({
      title: r.title ?? r.url ?? "(untitled)",
      url: r.url ?? "",
      snippet: r.content ?? "",
      publishedAt: r.published_date,
      score: r.score,
    }));
  }
}

// Default provider (cached) for the embedded TAVILY_API_KEY path. BYOK
// requests get a fresh per-request provider built from the user's key — no
// caching there, since providers are per-key.
let _defaultProvider: SearchProvider | null = null;

function getDefaultProvider(): SearchProvider {
  if (_defaultProvider) return _defaultProvider;
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  _defaultProvider = new TavilyProvider(apiKey);
  return _defaultProvider;
}

// Returns the right search provider for the current request — user-supplied
// when BYOK headers are present (read from AsyncLocalStorage), otherwise the
// shared embedded-key provider.
export function getSearchProvider(): SearchProvider {
  const userKey = getRequestTavilyKey();
  if (userKey) return new TavilyProvider(userKey);
  return getDefaultProvider();
}
