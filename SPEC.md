# Build "Crux" — A Civic Fact Verification Tool

> **Working name:** Crux. Alternates to consider: iSource, Provenance, Headwater, Steelman.
> **Parent project:** i-Resist (civic tech suite)

---

## 1. Project context

Build a web application that helps users assess factual claims they encounter in news, social media, and political discourse. The user pastes in a claim; the app decomposes it, searches the web with deliberately varied framings, traces citations toward primary sources, classifies the evidence, and returns a **structured evidence dossier** — never a verdict.

This is the opposite of a fact-checker badge. It is a tool for distributed epistemology: the output should make the user a better judge of the claim, not let them outsource the judgment.

The target users are civically engaged people who already distrust both partisan media and centralized fact-checkers, and who are willing to spend 30–90 seconds on a claim if the tool actually helps them think.

---

## 2. Design philosophy (non-negotiable)

These are not preferences — they are the entire point of the project. Every architectural and UX decision should be tested against them.

1. **No verdict.** The app never outputs "TRUE," "FALSE," "MOSTLY TRUE," a green check, a red X, or any equivalent. There is no verdict field in the data model. There is no verdict component in the UI. If a user pushes for one, the app explains why it doesn't have one.
2. **Surface evidence, not synthesis-as-conclusion.** The LLM's role is to decompose, search, classify, and structure — not to pronounce.
3. **Distinguish claim types.** Empirical facts, causal claims, definitional disputes, value judgments, and predictions each require different evidence and should be visually distinguished in the output.
4. **Surface disagreement structure.** When experts/sources disagree, the app shows *where* and *why*, not an averaged "consensus."
5. **Provenance over popularity.** A single primary source outranks fifty downstream citations. The app actively traces citations back toward the headwater.
6. **Time matters.** Every fact gets a temporal context. "X is CEO of Y" needs a date stamp; statistics need a vintage.
7. **The user does the last step.** The app builds the case file. The user judges.

---

## 3. Core features (full version, beyond MVP)

### 3.1 Claim input & normalization
- Paste a claim of any length (single sentence to a paragraph)
- Optional context field (where the user encountered it, what surrounded it)
- Normalization step: strip rhetoric, identify core assertion, flag if claim is too vague to verify and ask user to refine

### 3.2 Claim decomposition
Use the Anthropic API to break the claim into atomic sub-claims. Each sub-claim is classified as one of:
- **Empirical fact** (a verifiable state of the world)
- **Causal claim** (X causes/caused Y)
- **Definitional** (depends on how a contested term is defined)
- **Value judgment** (normative, not empirical)
- **Prediction** (about the future, not yet verifiable)
- **Comparative** (X is better/worse than Y — usually decomposes further)

Surface embedded assumptions and definitional ambiguities. Example: "Voter ID laws disenfranchise minorities" decomposes into definition of "voter ID law," definition of "disenfranchise," empirical correlation, causal claim, magnitude, counterfactual.

### 3.3 Multi-framing parallel search
For each empirical sub-claim, generate 3–5 search queries with deliberately varied framings (neutral, supportive, skeptical, technical, historical). Run them in parallel. The framing variety is a direct countermeasure to confirmation bias and SEO bubbles.

Use a search API that returns clean URLs and snippets — Brave Search API, Serper, or Tavily are reasonable. Avoid Google's official API for cost and ToS reasons; if needed, fall back to scraping with appropriate rate limiting and caching.

### 3.4 Source fetching & classification
For top-ranked results per query:
- Fetch full text (handle paywalls gracefully — note when a source is paywalled and degrade to abstract/snippet)
- Classify source type: primary research, secondary reporting, opinion/editorial, government/official, institutional, advocacy, social media, aggregator, unknown
- Extract publication date
- Note funding/affiliation where detectable
- Flag if the source is itself citing another source (which becomes a candidate for provenance tracing)

### 3.5 Provenance chain tracing
This is the feature that most distinguishes Crux from existing tools. For factual claims with citations, recursively trace citations backward:
- Article B cites Article A → fetch A
- A cites a study → identify the study, fetch it (or its abstract/PDF)
- Continue until reaching a primary source or a dead end

Display the chain visually. Many widely-repeated "facts" trace back to a single original source that has been retracted, misinterpreted, or was always weak. Surfacing this is genuinely valuable.

### 3.6 Steelman pair generator
For each contested sub-claim, use the LLM to construct:
- The strongest case **for** the claim, with the best supporting sources
- The strongest case **against** the claim, with the best supporting sources
- The best sources for each side (not the loudest — quality of evidence)

Both sides must be presented in good faith, with the same care.

### 3.7 Crux identification
Identify which sub-claim(s), if changed, would flip the conclusion. Surface these prominently. This transforms a "is X true?" question into "the answer to X depends on how we resolve Y." That reframe is the whole productive move in any contested factual debate.

### 3.8 Settled-vs-contested flag
For each sub-claim, classify into:
- **Empirically settled** (broad agreement among independent qualified sources)
- **Contested with evidence** (genuine empirical disagreement, mixed studies)
- **Contested by faction** (broad expert agreement but political/factional contestation)
- **Definitional dispute** (the disagreement is about what words mean, not facts)
- **Value-laden** (no amount of evidence will resolve this; it's about priorities)
- **Unknown / unresolvable with current evidence**

### 3.9 Temporal awareness
Every claim and source gets a time stamp. The dossier shows when sources were published and flags when a claim's truth value depends on currency (e.g., personnel claims, statistics, status claims).

### 3.10 Structured evidence dossier (the output)
The app's output is a navigable dossier, not a paragraph:
- Original claim at top
- Decomposition tree (sub-claims with type tags)
- Per sub-claim: settled-vs-contested badge, steelman pair, top sources with quality indicators, provenance chain if applicable, temporal context
- Crux summary at the top: "The strength of this claim hinges on X and Y"
- Unresolved questions section: things the app couldn't determine

---

## 4. UX principles

- **Mobile-first PWA.** Most users will encounter claims on their phones.
- **Progressive disclosure.** Top of dossier is scannable; details expand on tap.
- **Source quality is visual.** Use icons/colors for source type — primary research, peer-reviewed, government, opinion, etc. The user should see at a glance whether the case rests on RCTs or op-eds.
- **No verdict UI.** Resist this constantly. There will be a temptation to add a "summary" field that becomes a de facto verdict. Don't.
- **Friction before sharing.** If a share button exists, require the user to acknowledge they read the dossier before sharing. The app shouldn't be a vector for confident-sounding screenshots.
- **Show the work.** Every claim in the dossier links to a source. No floating assertions.
- **Honest about limits.** Include a persistent "What this tool can't do" section — listed in section 9 below — accessible from any dossier.

---

## 5. Tech stack (suggested; use your judgment)

- **Frontend:** React + Vite, TypeScript, Tailwind. PWA configuration for mobile install. Component library: shadcn/ui or headless UI.
- **Backend:** Node.js with Fastify (or Express). TypeScript end-to-end.
- **LLM:** Anthropic API. Use Claude Sonnet 4.6 or current equivalent for decomposition, synthesis, and steelman generation. Use Haiku for cheaper classification tasks.
- **Search:** Brave Search API (preferred) or Tavily.
- **Fetching:** A combination of direct fetch + a readability extractor (e.g., Mozilla's Readability or Defuddle) for clean article text. Handle PDFs (research papers) — use pdf-parse or similar.
- **Database:** PostgreSQL for persistent storage of dossiers, claim history, source cache. SQLite acceptable for single-user dev. Heavy caching of fetched sources to control cost and respect publishers.
- **Queue:** A job queue (BullMQ on Redis, or simpler in-memory for v1) since dossier generation is multi-step and slow — show progress to the user.
- **Hosting:** Whatever fits your existing pattern (you've used SiteGround / Cloudflare; Fly.io or Railway are good for Node + Postgres).

---

## 6. Suggested file structure

```
crux/
├── apps/
│   ├── web/                    # React PWA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ClaimInput.tsx
│   │   │   │   ├── DossierView.tsx
│   │   │   │   ├── SubClaimCard.tsx
│   │   │   │   ├── SteelmanPair.tsx
│   │   │   │   ├── ProvenanceChain.tsx
│   │   │   │   ├── SourceQualityBadge.tsx
│   │   │   │   ├── CruxSummary.tsx
│   │   │   │   └── LimitsDisclosure.tsx
│   │   │   ├── lib/api.ts
│   │   │   └── App.tsx
│   │   └── public/manifest.json
│   └── api/                    # Node backend
│       ├── src/
│       │   ├── routes/
│       │   │   ├── claims.ts
│       │   │   └── dossier.ts
│       │   ├── pipeline/
│       │   │   ├── decompose.ts
│       │   │   ├── search.ts
│       │   │   ├── fetch.ts
│       │   │   ├── classify.ts
│       │   │   ├── trace-provenance.ts
│       │   │   ├── steelman.ts
│       │   │   ├── identify-crux.ts
│       │   │   └── assemble-dossier.ts
│       │   ├── prompts/        # Anthropic prompts as versioned text files
│       │   └── db/
│       └── package.json
├── packages/
│   └── shared-types/           # TypeScript types shared between web and api
└── README.md
```

---

## 7. Build order (suggested phases)

**Phase 1 — Spine.** Claim input → decomposition → flat list of sub-claims with types → simple search per sub-claim → top 5 sources displayed. No steelman, no provenance, no crux. Just prove the pipeline works end to end.

**Phase 2 — Source quality.** Add source classification, dates, paywall handling, readable extraction. Make the dossier informative.

**Phase 3 — Steelman pairs.** Add the for/against generator for contested sub-claims.

**Phase 4 — Provenance tracing.** This is the hardest piece. Start with simple citation extraction; expand to recursive tracing.

**Phase 5 — Crux + settled-vs-contested classification.** Now the dossier has shape.

**Phase 6 — Polish: PWA, caching, progress UI, persistent dossier history, share with friction.**

Don't try to build phases 4–5 before phase 1 works.

---

## 8. What this is NOT

- Not a fact-checker. It does not pronounce.
- Not a search engine. The output is structured, not a list of links.
- Not a chat interface. Users come in with a claim and leave with a dossier; conversation is not the loop.
- Not a moderation tool. It does not flag content for removal anywhere.
- Not partisan. Steelman pairs are presented in good faith on both sides.

---

## 9. Honest limits (display these in-app)

The app should surface these clearly, not bury them. Suggested copy for an in-app disclosure:

> **What Crux can and can't do**
>
> Crux works best on **specific, decomposable factual claims** — vote counts, study findings, dates, named events, named people. It works progressively worse as you move toward broad narrative claims ("immigration is hurting the economy") or values questions ("was this policy good").
>
> Crux is only as good as what's on the indexed web. For genuinely cutting-edge or actively contested topics, the dossier will reflect biases in search rankings and source availability.
>
> Crux uses an AI model that can generate confident-sounding wrong synthesis. The dossier links every claim to a source for a reason: don't trust the synthesis, check the sources.
>
> Crux does not give you a verdict. That's a feature, not a bug. Pronouncements are how the information environment got polluted in the first place.

---

## 10. Notes on prompts

Store all Anthropic API prompts as versioned text files in `apps/api/src/prompts/`. They are part of the codebase, not hardcoded strings. Each prompt should specify expected output format (JSON schema) and include 2–3 few-shot examples drawn from real claims of varied types and political valence (mix domains: science, history, current events, statistics, biographies). Audit the prompts periodically for political balance — the app's neutrality lives or dies in these files.

---

## 11. First task for Claude Code

Set up the monorepo skeleton with the file structure above, the shared types package, and a working Phase 1 spine: a claim input that calls a backend endpoint, which calls the decomposition prompt, runs one search per sub-claim, fetches the top 3 results, and returns a flat dossier. Hardcode the source classification as "unknown" for now. Get this working end-to-end before adding any other feature.

When something is ambiguous or you're choosing between approaches, prefer the option that is **harder to misuse as a verdict generator**. That's the design tiebreaker for this project.
