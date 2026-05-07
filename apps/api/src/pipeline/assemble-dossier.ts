import { randomUUID } from "node:crypto";
import type {
  ClassifierUsed,
  Dossier,
  ProgressEvent,
  Source,
  SourceType,
  SubClaim,
} from "@crux/shared-types";
import { decompose } from "./decompose.js";
import { searchForSubClaim } from "./search.js";
import { type FetchResult } from "./fetch.js";
import { classifySources, type ClassifyInput } from "./classify.js";
import { generateSteelman, shouldSteelman } from "./steelman.js";
import { isTraceable, traceProvenance } from "./trace-provenance.js";
import { classifyContestation } from "./contestation.js";
import { identifyCrux } from "./identify-crux.js";
import { classifyByDomain } from "../lib/source-rules.js";
import { classifyCache, getCachedFetch } from "../lib/cache.js";
import type { SearchHit } from "../lib/search-provider.js";

// Intermediate shape used while we have a search hit but no fetch/classify yet.
interface RawHit {
  hitId: string;
  hit: SearchHit;
}

export type ProgressEmitter = (event: ProgressEvent) => void;

const NOOP_EMIT: ProgressEmitter = () => {
  /* default — no progress streaming */
};

export async function assembleDossier(
  claim: string,
  context?: string,
  emit: ProgressEmitter = NOOP_EMIT,
): Promise<Dossier> {
  emit({ step: "decomposing", message: "Decomposing claim into sub-claims…" });
  const decomposition = await decompose(claim, context);

  // Step 1: search per sub-claim, in parallel.
  emit({
    step: "searching",
    message: "Searching the web for each sub-claim…",
    sublabel: `${decomposition.subClaims.length} sub-claim${decomposition.subClaims.length === 1 ? "" : "s"}`,
  });
  const subClaimsRaw = await Promise.all(
    decomposition.subClaims.map(async (sc) => {
      const hits = await searchForSubClaim(sc.searchQuery);
      const rawHits: RawHit[] = hits.map((hit) => ({ hitId: randomUUID(), hit }));
      return { sc, rawHits };
    }),
  );

  // Step 2: fetch (readability + paywall + date) every hit in parallel across all sub-claims.
  // Cached lookups are instant; uncached ones bound by FETCH_TIMEOUT_MS in fetch.ts.
  const allHits = subClaimsRaw.flatMap((s) => s.rawHits);
  emit({
    step: "fetching",
    message: "Fetching source content and extracting publication dates…",
    sublabel: `${allHits.length} source${allHits.length === 1 ? "" : "s"}`,
  });
  const fetchResults = new Map<string, FetchResult>();
  await Promise.all(
    allHits.map(async ({ hitId, hit }) => {
      const result = await getCachedFetch(hit.url);
      fetchResults.set(hitId, result);
    }),
  );

  // Step 3: classify. Rules first (per URL); LLM-batch the rule-misses across all
  // sub-claims so we make at most ONE LLM call per dossier instead of one per source.
  emit({ step: "classifying_sources", message: "Classifying sources by type…" });
  const classifications = await classifyAll(allHits);

  // Step 4: build SubClaim[] with enriched Source[]. The hitId is promoted
  // to Source.id so steelman arguments (next step) can cite stable references.
  const subClaimsBase: SubClaim[] = subClaimsRaw.map(({ sc, rawHits }): SubClaim => {
    const sources: Source[] = rawHits.map(({ hitId, hit }): Source => {
      const fetched = fetchResults.get(hitId);
      const cls = classifications.get(hitId) ?? {
        type: "unknown" as SourceType,
        classifierUsed: "fallback" as ClassifierUsed,
      };
      return {
        id: hitId,
        title: hit.title,
        url: hit.url,
        // Prefer the snippet from Tavily, but if we extracted a fuller text, use a
        // beefier preview. Either way the user can click through.
        snippet: fetched?.fullText ?? hit.snippet,
        publishedAt: fetched?.publishedAt ?? hit.publishedAt,
        sourceType: cls.type,
        classifierUsed: cls.classifierUsed,
        paywalled: fetched?.paywalled,
        fetchError: fetched?.fetchError,
      };
    });
    return {
      id: randomUUID(),
      text: sc.text,
      type: sc.type,
      searchQuery: sc.searchQuery,
      sources,
    };
  });

  // Step 5: provenance tracing — Phase 4. Walks citations upstream from
  // secondary_reporting sources (up to 2 hops) to find primary sources.
  // Run in parallel across all qualifying sources from all sub-claims.
  const traceableSources = subClaimsBase.flatMap((sc) =>
    sc.sources.filter((src) => isTraceable(src.sourceType, src.paywalled, src.fetchError)),
  );
  emit({
    step: "tracing_provenance",
    message: "Tracing citations upstream toward primary sources…",
    sublabel:
      traceableSources.length === 0
        ? "no traceable sources"
        : `${traceableSources.length} source${traceableSources.length === 1 ? "" : "s"}`,
  });
  const provenanceMap = new Map<string, Awaited<ReturnType<typeof traceProvenance>>>();
  await Promise.all(
    subClaimsBase.flatMap((sc) =>
      sc.sources
        .filter((src) => isTraceable(src.sourceType, src.paywalled, src.fetchError))
        .map(async (src) => {
          const fetchedForSrc = fetchResults.get(src.id);
          const chain = await traceProvenance({
            url: src.url,
            sourceType: src.sourceType,
            fetchResult: fetchedForSrc,
          });
          // Only attach a chain if it actually resolved at least one link OR
          // it gives the user useful information about why the trace stopped.
          // "no_citations_found" with 0 links is informative — surface it.
          provenanceMap.set(src.id, chain);
        }),
    ),
  );
  const subClaimsWithProvenance: SubClaim[] = subClaimsBase.map((sc) => ({
    ...sc,
    sources: sc.sources.map((src): Source => {
      const chain = provenanceMap.get(src.id);
      return chain ? { ...src, provenance: chain } : src;
    }),
  }));

  // Step 6: steelman pairs — one Sonnet call per applicable sub-claim, in parallel.
  // Skipped for sub-claim types that aren't resolved by evidence (definitional,
  // value_judgment) and for sub-claims with too few sources to anchor a contrast.
  const steelmanCount = subClaimsWithProvenance.filter((sc) =>
    shouldSteelman(sc.type, sc.sources),
  ).length;
  emit({
    step: "generating_steelmans",
    message: "Building strongest cases for and against each sub-claim…",
    sublabel:
      steelmanCount === 0
        ? "no applicable sub-claims"
        : `${steelmanCount} sub-claim${steelmanCount === 1 ? "" : "s"}`,
  });
  const subClaimsWithSteelman: SubClaim[] = await Promise.all(
    subClaimsWithProvenance.map(async (sc): Promise<SubClaim> => {
      if (!shouldSteelman(sc.type, sc.sources)) return sc;
      const steelman = await generateSteelman({
        subClaim: sc.text,
        subClaimType: sc.type,
        sources: sc.sources,
      });
      return steelman ? { ...sc, steelman } : sc;
    }),
  );

  // Step 7: contestation classification per sub-claim, in parallel.
  // Rule-classifies value_judgment / definitional sub-claims for free; LLM call
  // only fires for sub-claims where evidence shape determines the label.
  emit({
    step: "classifying_contestation",
    message: "Labeling each sub-claim by where the disagreement sits…",
  });
  const subClaims: SubClaim[] = await Promise.all(
    subClaimsWithSteelman.map(async (sc): Promise<SubClaim> => {
      const contestation = await classifyContestation({
        subClaim: sc.text,
        subClaimType: sc.type,
        sources: sc.sources,
        steelman: sc.steelman,
      });
      return contestation ? { ...sc, contestation } : sc;
    }),
  );

  // Step 8: dossier-level crux identification — one call using the full sub-claim
  // set with contestations and steelmans. Output is structural ("hinges on X")
  // not evaluative ("looks true").
  emit({ step: "identifying_crux", message: "Identifying what the claim hinges on…" });
  const crux = await identifyCrux({ claim, subClaims });

  return {
    id: randomUUID(),
    claim,
    context,
    createdAt: new Date().toISOString(),
    subClaims,
    embeddedAssumptions: decomposition.embeddedAssumptions,
    unresolvedQuestions: decomposition.unresolvedQuestions,
    crux: crux ?? undefined,
  };
}

// Classify all hits in one shot. Cache hits skip the LLM entirely.
// Rule-only matches (e.g. nytimes.com → secondary_reporting) also skip the LLM.
async function classifyAll(
  hits: RawHit[],
): Promise<Map<string, { type: SourceType; classifierUsed: ClassifierUsed }>> {
  const out = new Map<string, { type: SourceType; classifierUsed: ClassifierUsed }>();
  const llmInputs: ClassifyInput[] = [];

  for (const { hitId, hit } of hits) {
    // Cache hit (URL-keyed)
    const cached = classifyCache.get(hit.url);
    if (cached) {
      // We don't store the original classifierUsed in the cache — re-derive it.
      // If the URL matches a rule, it must have been "rule"; otherwise "llm".
      const fromRule = classifyByDomain(hit.url);
      out.set(hitId, {
        type: cached,
        classifierUsed: fromRule === cached ? "rule" : "llm",
      });
      continue;
    }
    // Rule hit
    const ruleType = classifyByDomain(hit.url);
    if (ruleType !== null) {
      out.set(hitId, { type: ruleType, classifierUsed: "rule" });
      classifyCache.set(hit.url, ruleType);
      continue;
    }
    // Otherwise, batch through LLM
    llmInputs.push({ id: hitId, url: hit.url, title: hit.title, snippet: hit.snippet });
  }

  if (llmInputs.length > 0) {
    const llmOut = await classifySources(llmInputs);
    const inputById = new Map(llmInputs.map((i) => [i.id, i]));
    for (const c of llmOut) {
      out.set(c.id, { type: c.type, classifierUsed: c.classifierUsed });
      const input = inputById.get(c.id);
      if (input && c.classifierUsed !== "fallback") {
        classifyCache.set(input.url, c.type);
      }
    }
  }

  return out;
}
