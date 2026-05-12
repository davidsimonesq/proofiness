// Fetches a URL, runs Mozilla Readability, extracts publication date, detects paywalls.
//
// All errors are returned as a `fetchError` field on the result — never thrown.
// The caller falls back to the Tavily snippet either way; this module's job is
// to enrich what's already there, not to be the single point of failure.

import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";

// jsdom's default virtual console writes CSS parse errors and other warnings
// straight to stderr — a single Divi/WordPress page can produce dozens of
// noisy stack traces. We don't act on those signals (Readability cares about
// text, not styles), so use an empty VirtualConsole to drop them on the floor.
const SILENT_CONSOLE = new VirtualConsole();

const FETCH_TIMEOUT_MS = 10_000;
// Bumped in Phase 4: provenance needs the full article to extract cited
// sources from prose. Existing pipelines (classify, steelman) slice down to
// what they need (400, 800 chars), so the per-call token cost barely changes
// downstream — this just makes more text available to the consumers that need it.
const MAX_FULL_TEXT_CHARS = 20_000;
const MIN_TEXT_FOR_NO_PAYWALL = 400;

const USER_AGENT =
  "Mozilla/5.0 (compatible; Proofiness/0.1; +https://github.com/davidsimonesq/crux) civic-fact-verification";

const PAYWALL_MARKERS = [
  "subscribe to continue",
  "subscribe now",
  "subscribe today",
  "sign in to read",
  "sign in to continue",
  "log in to read",
  "log in to continue",
  "create a free account",
  "create an account to continue",
  "to continue reading",
  "you've reached your limit",
  "you have reached your limit",
  "please subscribe",
  "subscriber-only",
  "subscribers only",
  "for subscribers",
  "premium content",
  "premium article",
  "this content is for subscribers",
];

export interface OutboundLink {
  href: string;
  text: string;
  // Surrounding paragraph (truncated) — gives the citation tracer prose context
  // for the link, useful when the anchor text is uninformative ("here", "this study").
  paragraphContext?: string;
}

export interface FetchResult {
  paywalled: boolean;
  fetchError?: string;
  fullText?: string;
  publishedAt?: string;
  // Outbound (cross-domain) links extracted from the article body. Populated
  // when readability succeeds and the body has identifiable article scope.
  // Used by Phase 4 provenance tracing — empty for sources where it's not needed.
  outboundLinks?: OutboundLink[];
}

export async function fetchAndExtract(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    return { paywalled: false, fetchError: `network: ${msg}` };
  }
  clearTimeout(timeout);

  // Auth walls = paywall. 402 is literally "Payment Required".
  if (response.status === 401 || response.status === 402 || response.status === 403) {
    return { paywalled: true, fetchError: `http ${response.status}` };
  }
  if (!response.ok) {
    return { paywalled: false, fetchError: `http ${response.status}` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("html")) {
    return { paywalled: false, fetchError: `non-html content-type: ${contentType.split(";")[0]}` };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { paywalled: false, fetchError: `body: ${msg}` };
  }

  let dom: JSDOM;
  try {
    dom = new JSDOM(html, { url, virtualConsole: SILENT_CONSOLE });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { paywalled: false, fetchError: `parse: ${msg}` };
  }

  // Date extraction can run even if Readability fails — pull from meta tags first.
  const publishedAt = extractPublishedDate(dom.window.document, url);

  let textContent = "";
  let readabilityPublished: string | undefined;
  try {
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article) {
      textContent = (article.textContent ?? "").trim();
      readabilityPublished = article.publishedTime ?? undefined;
    }
  } catch {
    // Readability failed — fall through with empty textContent. paywall check
    // below will use the raw HTML body text as a backstop.
  }

  // Paywall heuristic: short extracted text + paywall markers anywhere in the page.
  const haystack = (textContent || dom.window.document.body?.textContent || "").toLowerCase();
  const matchedMarker = PAYWALL_MARKERS.find((m) => haystack.includes(m));
  const paywalled =
    matchedMarker !== undefined && textContent.length < MIN_TEXT_FOR_NO_PAYWALL;

  const fullText = textContent
    ? textContent.slice(0, MAX_FULL_TEXT_CHARS)
    : undefined;

  const outboundLinks = extractOutboundLinks(dom.window.document, url);

  return {
    paywalled,
    fullText,
    publishedAt: readabilityPublished ?? publishedAt,
    outboundLinks,
  };
}

const MAX_OUTBOUND_LINKS = 50;

// Extract cross-domain links from the article body, with paragraph context.
// Filters out social-share buttons, asset URLs, same-domain (lateral) links,
// and obvious nav junk.
function extractOutboundLinks(doc: Document, parentUrl: string): OutboundLink[] {
  let parentHost: string;
  try {
    parentHost = new URL(parentUrl).hostname.replace(/^www\./, "");
  } catch {
    return [];
  }

  const article =
    doc.querySelector("article") ||
    doc.querySelector("main") ||
    doc.body;
  if (!article) return [];

  const seen = new Set<string>();
  const out: OutboundLink[] = [];

  for (const a of article.querySelectorAll("a[href]")) {
    if (out.length >= MAX_OUTBOUND_LINKS) break;
    const href = a.getAttribute("href");
    if (!href) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, parentUrl);
    } catch {
      continue;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") continue;

    const host = resolved.hostname.replace(/^www\./, "");
    if (host === parentHost) continue;
    if (/(twitter|x|facebook|linkedin|reddit|threads|bsky|instagram|tiktok|youtube)\.com$/i.test(host)) {
      continue;
    }
    if (resolved.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|css|js|ico)$/i)) continue;

    const finalHref = `${resolved.origin}${resolved.pathname}${resolved.search}`;
    if (seen.has(finalHref)) continue;
    seen.add(finalHref);

    const text = (a.textContent ?? "").trim().slice(0, 200) || resolved.hostname;
    const para = a.closest("p")?.textContent?.trim().slice(0, 400);

    out.push({
      href: finalHref,
      text,
      paragraphContext: para || undefined,
    });
  }
  return out;
}

// Try several common date-meta sources, in order of reliability.
function extractPublishedDate(doc: Document, url: string): string | undefined {
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[property="og:article:published_time"]',
    'meta[name="pubdate"]',
    'meta[name="publishdate"]',
    'meta[name="date"]',
    'meta[name="DC.date"]',
    'meta[name="DC.date.issued"]',
    'meta[itemprop="datePublished"]',
  ];
  for (const sel of metaSelectors) {
    const el = doc.querySelector(sel);
    const content = el?.getAttribute("content");
    if (content) {
      const iso = toIso(content);
      if (iso) return iso;
    }
  }

  // <time datetime="..."> — usually the publication line
  const timeEl = doc.querySelector("time[datetime]");
  const timeAttr = timeEl?.getAttribute("datetime");
  if (timeAttr) {
    const iso = toIso(timeAttr);
    if (iso) return iso;
  }

  // URL pattern fallback: /YYYY/MM/DD/
  const m = url.match(/\/(\d{4})\/(\d{1,2})\/(\d{1,2})\//);
  if (m) {
    const [, y, mo, d] = m;
    const iso = toIso(`${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}`);
    if (iso) return iso;
  }

  return undefined;
}

function toIso(input: string): string | undefined {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
