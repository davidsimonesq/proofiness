# Crux

Civic fact-verification dossier tool. Paste a claim → get a structured evidence dossier. **Never a verdict.**

Part of the i-Resist civic tech suite. See `crux-build-prompt.md` (in the user's notes) for the full design philosophy.

## Phase 1 (current)

End-to-end spine: claim input → LLM decomposition → search per sub-claim → flat dossier with top 3 sources each. Source classification is hardcoded to `unknown`. No steelman, no provenance tracing, no crux identification yet — those come in later phases.

## Repo layout

```
crux/
├── apps/
│   ├── web/                React + Vite + Tailwind PWA
│   └── api/                Fastify + TypeScript backend
├── packages/
│   └── shared-types/       Types shared between web and api
└── package.json            npm workspaces root
```

## Setup

Requires Node 18.17+.

```sh
cd crux
npm install
npm run setup   # interactive prompt for ANTHROPIC_API_KEY and TAVILY_API_KEY
```

`npm run setup` writes `apps/api/.env`. Re-run any time to update keys — current
values appear as defaults (secrets masked); press enter to keep, type to overwrite.

If you'd rather edit the file by hand, `cp apps/api/.env.example apps/api/.env`
and edit `apps/api/.env` directly works too.

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

Open http://localhost:5173, paste a claim, hit Submit.

## Build / typecheck

```sh
npm run typecheck
npm run build
```

## Design tiebreaker

When in doubt, pick the option that is **harder to misuse as a verdict generator**. No verdict UI, no summary-as-conclusion, no green check / red X.
