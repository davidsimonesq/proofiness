# Proofiness

Civic fact-verification dossier tool. Paste a claim → get a structured evidence dossier. **Never a verdict.**

Part of the i-Resist civic tech suite. See [`SPEC.md`](./SPEC.md) for the full design philosophy. (The spec uses the original working name "Crux" — the project was renamed to Proofiness during development. Two semantic terms remain `Crux`/`crux` in the code, by design: see "Naming" below.)

## What it does

For any claim you paste:

1. **Normalizes** the input — strips rhetoric, refuses vague inputs with refinement suggestions.
2. **Decomposes** into atomic sub-claims, each tagged by type (empirical, causal, definitional, value, prediction, comparative).
3. **Searches** the web with multiple framings per sub-claim (neutral / supportive / skeptical / technical / historical) — a direct countermeasure to confirmation bias and SEO bubbles.
4. **Classifies sources** by type (peer-reviewed, government, secondary reporting, advocacy, etc.) — hybrid of curated domain rules + Haiku LLM.
5. **Traces provenance** — for every secondary-reporting source, walks citations upstream up to two hops to find the primary source the chain ends at.
6. **Generates steelman pairs** — strongest case for and against each sub-claim, with explicit "no fabricated symmetry" guardrail.
7. **Labels contestation** per sub-claim: settled / contested-with-evidence / contested-by-faction / definitional / value-laden / unresolvable.
8. **Identifies the crux** — which sub-claim(s), if changed, would flip the strength of the overall claim. Surfaces them at the top of the dossier as structural framing, never as a verdict.

## Repo layout

```
proofiness/
├── apps/
│   ├── web/                React + Vite + Tailwind PWA (IBM Plex font system)
│   └── api/                Fastify + TypeScript backend (SSE streaming)
├── packages/
│   └── shared-types/       Types shared between web and api
└── package.json            npm workspaces root
```

## Setup

Requires Node 18.17+.

```sh
cd proofiness
npm install
npm run setup   # interactive prompt for ANTHROPIC_API_KEY and TAVILY_API_KEY
```

`npm run setup` writes `apps/api/.env`. Re-run any time to update keys — current values appear as defaults (secrets masked); press enter to keep, type to overwrite.

If you'd rather edit the file by hand, `cp apps/api/.env.example apps/api/.env` and edit it directly.

Get keys:
- `ANTHROPIC_API_KEY` — https://console.anthropic.com/
- `TAVILY_API_KEY` — https://tavily.com/ (free tier is fine for dev)

## Run

Two terminals:

```sh
# Terminal 1 — API on :8787
npm run dev:api

# Terminal 2 — Web on :5173
npm run dev:web
```

Open http://localhost:5173, paste a claim, hit Submit. Cold dossiers take 60–180 seconds — the pipeline is making real searches and LLM calls.

## Build / typecheck

```sh
npm run typecheck
npm run build
```

## Design tiebreaker

When in doubt, pick the option that is **harder to misuse as a verdict generator**. No verdict UI, no summary-as-conclusion, no green check / red X. Visual treatment is monochrome (warm cool gray + ink + a single restrained burnished-brass accent for crux markers). Every interpretive surface — the crux summary, the contestation labels, the steelman framing — has explicit prompt-level and code-level guards against verdict drift.

## Naming

The product is **Proofiness**. Two terms in the code stay `Crux`/`crux` by design — they refer to a spec-§3.7 concept, not the product:

- The `Crux` interface in `@proofiness/shared-types` (the dossier-level "what does this hinge on" object).
- The `CruxSummary` component, `identifyCrux()` function, `prompts/crux.md`, and the `dossier.crux` field — all naming the *crux of a claim*.

If you read code that says `dossier.crux`, that's "the crux of this claim's argument," not "the Crux project."
