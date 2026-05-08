// Domain → SourceType rules for the rule-based half of the hybrid classifier.
//
// METHODOLOGY: Be conservative. Every entry here is an editorial judgment with
// bias risk. We only include mappings that meet ALL three criteria:
//
//   1. The domain has a single dominant content type (e.g. nytimes.com is
//      overwhelmingly secondary reporting; .gov is overwhelmingly government).
//   2. The classification is the kind of thing two reasonable people from
//      different political camps would both agree on.
//   3. Misclassification would be visible — i.e. it would obviously look wrong,
//      not subtly tilt a dossier.
//
// Anything that fails any of those — most think tanks, advocacy orgs,
// borderline outlets, opinion vs reporting on the same domain — falls through
// to the LLM classifier. This list is biased toward LEAVING THINGS OUT.
//
// Audit this list periodically (per spec §10 — "audit the prompts periodically
// for political balance"). Same applies here: this list is part of the
// classification surface and lives or dies in the same way prompts do.

import type { SourceType } from "@proofiness/shared-types";

interface DomainRule {
  // Matches against the registrable hostname (no leading "www.").
  pattern: RegExp;
  type: SourceType;
}

const RULES: DomainRule[] = [
  // ─── Government (national, supranational, multilateral) ────────────────────
  // .gov, .mil, country-coded gov subdomains
  { pattern: /(^|\.)gov$/i, type: "government" },
  { pattern: /(^|\.)mil$/i, type: "government" },
  { pattern: /(^|\.)gov\.[a-z]{2,}$/i, type: "government" }, // .gov.uk, .gov.ca, .gov.au, .gov.in
  { pattern: /(^|\.)gob\.[a-z]{2,}$/i, type: "government" }, // Spanish-speaking govs
  { pattern: /(^|\.)europa\.eu$/i, type: "government" },
  { pattern: /(^|\.)un\.org$/i, type: "government" },
  { pattern: /(^|\.)who\.int$/i, type: "government" },
  { pattern: /(^|\.)imf\.org$/i, type: "government" },
  { pattern: /(^|\.)worldbank\.org$/i, type: "government" },
  { pattern: /(^|\.)oecd\.org$/i, type: "government" },
  { pattern: /(^|\.)nato\.int$/i, type: "government" },

  // ─── Peer-reviewed journals + DOI/preprint hosts ──────────────────────────
  { pattern: /(^|\.)doi\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)nature\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)science\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)sciencemag\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)cell\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)nejm\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)thelancet\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)bmj\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)jamanetwork\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)pnas\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)springer\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)link\.springer\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)sciencedirect\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)wiley\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)tandfonline\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)sagepub\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)cambridge\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)oup\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)mdpi\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)plos\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)frontiersin\.org$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)pubmed\.ncbi\.nlm\.nih\.gov$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)ncbi\.nlm\.nih\.gov$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)pubmed\.gov$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)scopus\.com$/i, type: "peer_reviewed" },
  { pattern: /(^|\.)jstor\.org$/i, type: "peer_reviewed" },

  // ─── Preprint servers (primary research, but not yet peer-reviewed) ───────
  { pattern: /(^|\.)arxiv\.org$/i, type: "primary_research" },
  { pattern: /(^|\.)biorxiv\.org$/i, type: "primary_research" },
  { pattern: /(^|\.)medrxiv\.org$/i, type: "primary_research" },
  { pattern: /(^|\.)ssrn\.com$/i, type: "primary_research" },
  { pattern: /(^|\.)nber\.org$/i, type: "primary_research" },
  { pattern: /(^|\.)osf\.io$/i, type: "primary_research" },

  // ─── Wire services + major news (secondary reporting) ─────────────────────
  // NOTE: opinion/editorial content on these same domains is handled by the
  // OPINION_PATH_PATTERNS check at the bottom of this file — that runs BEFORE
  // these rules, so /opinion/, /editorial/, /op-ed/, /columnists/ paths get
  // classified as `opinion` instead of `secondary_reporting`.
  { pattern: /(^|\.)reuters\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)apnews\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)ap\.org$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)afp\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)bbc\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)bbc\.co\.uk$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)nytimes\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)washingtonpost\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)wsj\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)theguardian\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)ft\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)economist\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)npr\.org$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)pbs\.org$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)bloomberg\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)cnn\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)foxnews\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)msnbc\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)nbcnews\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)cbsnews\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)abcnews\.go\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)usatoday\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)nypost\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)washingtontimes\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)washingtonexaminer\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)politico\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)axios\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)thehill\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)propublica\.org$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)aljazeera\.com$/i, type: "secondary_reporting" },
  { pattern: /(^|\.)dw\.com$/i, type: "secondary_reporting" },

  // ─── Aggregators / encyclopedias ──────────────────────────────────────────
  { pattern: /(^|\.)wikipedia\.org$/i, type: "aggregator" },
  { pattern: /(^|\.)wikimedia\.org$/i, type: "aggregator" },
  { pattern: /(^|\.)britannica\.com$/i, type: "aggregator" },
  { pattern: /(^|\.)snopes\.com$/i, type: "aggregator" },
  { pattern: /(^|\.)factcheck\.org$/i, type: "aggregator" },
  { pattern: /(^|\.)politifact\.com$/i, type: "aggregator" },

  // ─── Social media / hosted-author platforms ───────────────────────────────
  // Note: medium.com and substack.com are platforms, not publishers — content
  // quality varies wildly. Treating them as social_media is the conservative
  // call (the user should evaluate the individual author).
  { pattern: /(^|\.)twitter\.com$/i, type: "social_media" },
  { pattern: /(^|\.)x\.com$/i, type: "social_media" },
  { pattern: /(^|\.)facebook\.com$/i, type: "social_media" },
  { pattern: /(^|\.)instagram\.com$/i, type: "social_media" },
  { pattern: /(^|\.)reddit\.com$/i, type: "social_media" },
  { pattern: /(^|\.)tiktok\.com$/i, type: "social_media" },
  { pattern: /(^|\.)youtube\.com$/i, type: "social_media" },
  { pattern: /(^|\.)youtu\.be$/i, type: "social_media" },
  { pattern: /(^|\.)medium\.com$/i, type: "social_media" },
  { pattern: /(^|\.)substack\.com$/i, type: "social_media" },
  { pattern: /(^|\.)linkedin\.com$/i, type: "social_media" },
  { pattern: /(^|\.)threads\.net$/i, type: "social_media" },
  { pattern: /(^|\.)bsky\.app$/i, type: "social_media" },
  { pattern: /(^|\.)mastodon\.social$/i, type: "social_media" },

  // ─── Academic/educational catch-alls (last — most specific rules win) ─────
  { pattern: /(^|\.)edu$/i, type: "institutional" },
  { pattern: /(^|\.)ac\.[a-z]{2,}$/i, type: "institutional" }, // .ac.uk, .ac.jp
];

function normalizeHostname(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

// URL-path patterns that indicate opinion/editorial content. Checked before
// the news-outlet rule so that nytimes.com/opinion/... is classified as
// `opinion` rather than `secondary_reporting`. The classify.md prompt
// explicitly says "Use `opinion` ONLY when the URL path or title clearly
// marks the piece" — this enforces that on the rule path too.
const OPINION_PATH_PATTERNS = [
  /\/opinion\//i,
  /\/opinions\//i,
  /\/editorial\//i,
  /\/editorials\//i,
  /\/op-?ed\//i,
  /\/columnists?\//i,
  /\/perspectives?\//i,
];

function isOpinionPath(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    return OPINION_PATH_PATTERNS.some((p) => p.test(path));
  } catch {
    return false;
  }
}

/**
 * Returns a SourceType if the URL matches a curated rule, or null if no rule
 * matches (in which case the LLM classifier should run).
 *
 * Order:
 *   1. Opinion-path detection — wins over the news-outlet rule.
 *   2. Domain rules (news outlets, journals, government, social, etc.).
 */
export function classifyByDomain(url: string): SourceType | null {
  if (isOpinionPath(url)) return "opinion";
  const host = normalizeHostname(url);
  if (!host) return null;
  for (const rule of RULES) {
    if (rule.pattern.test(host)) return rule.type;
  }
  return null;
}
