// Crux shared types — used by both web and api.
// Phase 2: source classification + readability fetch + paywall + dates.

export type ClaimType =
  | "empirical_fact"
  | "causal"
  | "definitional"
  | "value_judgment"
  | "prediction"
  | "comparative";

export type SourceType =
  | "unknown"
  | "primary_research"
  | "peer_reviewed"
  | "secondary_reporting"
  | "opinion"
  | "government"
  | "institutional"
  | "advocacy"
  | "social_media"
  | "aggregator";

// How the SourceType was decided. Surfaced in the UI so the user can weight it.
// "rule" = curated domain map; "llm" = Haiku-batched classification; "fallback" = neither succeeded.
export type ClassifierUsed = "rule" | "llm" | "fallback";

export interface Source {
  // Stable per-dossier id so steelman arguments can cite specific sources.
  id: string;
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  sourceType: SourceType;
  classifierUsed: ClassifierUsed;
  // True if the page appears to be paywalled or returned an auth wall.
  // Distinct from fetchError — paywalled means we got a response but it was gated.
  paywalled?: boolean;
  // Set when the readability fetch failed (network error, non-2xx, parse failure).
  // The Tavily snippet is still available in `snippet` either way.
  fetchError?: string;
  // Set only on sources where provenance tracing was attempted (currently:
  // secondary_reporting). Phase 4 MVP traces up to depth 2.
  provenance?: ProvenanceChain;
}

// Why the trace stopped. Drives the UI's terminus indicator — users should
// know whether the chain ended at a primary source or just hit a wall.
export type TerminusReason =
  | "primary_source_reached" // landed on primary_research / peer_reviewed / government
  | "depth_limit"            // hit the hop cap (still might trace further given more depth)
  | "no_citations_found"     // article didn't link or paraphrase any tractable source
  | "dead_end"               // candidates existed but resolution + fetch all failed
  | "trace_failed";          // pipeline error — extraction or classification call broke

export type ResolutionMethod =
  | "linked"            // <a href> in the article
  | "inferred_searched" // LLM read the prose, named a citation, search resolved it
  | "linked_inferred";  // both — linked AND named in prose, high-confidence match

export interface ProvenanceLink {
  // The new (downstream) source we landed on. Same shape as a regular Source
  // EXCEPT we don't recurse provenance further on the link itself — chain
  // recursion happens at the chain level, not nested per-link.
  url: string;
  title: string;
  sourceType: SourceType;
  classifierUsed: ClassifierUsed;
  publishedAt?: string;
  paywalled?: boolean;
  fetchError?: string;
  // How we found this citation in the parent article.
  resolutionMethod: ResolutionMethod;
  // What the parent said about this citation (the claim it was supporting).
  // Pulled from prose context near the citation. Helps the user evaluate
  // whether the citation actually supports what the parent says it supports.
  citationContext?: string;
}

export interface ProvenanceChain {
  // Hops from the root source. links[0] is what the root cites; links[1] is
  // what links[0] cites; etc. Linear chain (first/best citation per hop).
  links: ProvenanceLink[];
  terminusReason: TerminusReason;
}

// One side of a steelman pair. The asymmetry signal lives in the prose of
// `argument` — we deliberately don't ship an "evidenceStrength" enum because
// it would function as a verdict-by-proxy. If the available sources don't
// support a substantive case for this side, the model says so in plain prose
// and `sourceIds` is empty.
export interface SteelmanSide {
  argument: string;
  sourceIds: string[];
}

export interface Steelman {
  for: SteelmanSide;
  against: SteelmanSide;
}

// Per spec §3.8 — six categories. Two are derivable from sub-claim type alone
// (definitional/value_judgment); the rest require an LLM judgment from the
// available evidence. The note carries the structural reason for the label.
export type Contestation =
  | "empirically_settled"     // broad agreement among independent qualified sources
  | "contested_with_evidence" // genuine empirical disagreement, mixed studies
  | "contested_by_faction"    // broad expert agreement, but political/factional contestation
  | "definitional_dispute"    // disagreement is about word meaning, not facts
  | "value_laden"             // no amount of evidence resolves it
  | "unresolvable_unknown";   // not enough evidence available to tell

export interface ContestationLabel {
  label: Contestation;
  // 1–2 sentence STRUCTURAL note: where the agreement / disagreement sits.
  // NOT a verdict, NOT a confidence score.
  note: string;
}

export interface SubClaim {
  id: string;
  text: string;
  type: ClaimType;
  searchQuery: string;
  sources: Source[];
  // Only generated for sub-claims where evidence can speak both ways
  // (empirical_fact, causal, comparative, prediction). Skipped for
  // definitional and value_judgment — those don't get resolved by sources.
  steelman?: Steelman;
  // Phase 5: settled-vs-contested classification per sub-claim.
  contestation?: ContestationLabel;
}

// Phase 5: dossier-level "what does this hinge on" summary.
// Spec §3.7: "the answer to X depends on how we resolve Y" — that reframe is
// the productive move in any contested factual debate. The summary is
// STRUCTURAL (what depends on what), never EVALUATIVE (which side is right).
export interface Crux {
  // SubClaim.id values that, if their answer changed, would flip the
  // overall claim's strength. May be empty if nothing hinges (e.g., the
  // claim's empirical core is settled and the disagreement is purely value-laden).
  hingesOn: string[];
  // 1–2 sentence prose framing of the dependency structure. Not a verdict.
  // Examples: "This claim's empirical core is settled; the substantive
  // disagreement is in how to define 'won.'" / "Two questions drive the
  // answer: whether the policy caused the outcome, and how 'disenfranchise'
  // is defined."
  summary: string;
}

export interface Dossier {
  id: string;
  claim: string;
  context?: string;
  createdAt: string;
  subClaims: SubClaim[];
  embeddedAssumptions: string[];
  unresolvedQuestions: string[];
  // Phase 5: what the strength of this claim hinges on.
  crux?: Crux;
}

// Wire format for POST /api/dossier
export interface CreateDossierRequest {
  claim: string;
  context?: string;
}

export interface CreateDossierResponse {
  dossier: Dossier;
}

export interface ApiError {
  error: string;
  detail?: string;
}

// SSE progress events streamed during dossier generation. Stable identifiers
// so the UI can map them to a step indicator. `sublabel` is optional context
// (e.g. "3 sub-claims" or "tracing nytimes.com").
export type ProgressStep =
  | "decomposing"
  | "searching"
  | "fetching"
  | "classifying_sources"
  | "tracing_provenance"
  | "generating_steelmans"
  | "classifying_contestation"
  | "identifying_crux"
  | "persisting";

export interface ProgressEvent {
  step: ProgressStep;
  message: string;
  sublabel?: string;
}

// One-line summary of a stored dossier — used by GET /api/dossiers (history list).
export interface DossierSummary {
  id: string;
  claim: string;
  createdAt: string;
}
