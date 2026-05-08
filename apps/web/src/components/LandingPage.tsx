import type { ReactNode } from "react";
import { APP_HASH } from "../lib/route.js";

// Landing page for first-time visitors. The existing Header (wordmark +
// tagline + intro paragraph) functions as the hero; this component picks up
// from there with the marketing sections. Pattern matched from sibling
// i-Resist apps (amithea-hole.com, amithedingbat.com, myaipro.org): single-
// page scroll, generous whitespace, primary CTA top + bottom, numbered
// "How It Works", restrained palette, conversational-but-substantive tone.
//
// Visual continuity with the app: same IBM Plex font system, same stone
// palette, same brass accent. Different LAYOUT (more whitespace, bigger type,
// less small-caps density) but same VOCABULARY.

export function LandingPage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      {/* Primary CTA — anchored under the existing Header */}
      <section className="space-y-4">
        <PrimaryCTA />
        <p className="text-center font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
          Free · Open source · No accounts
        </p>
      </section>

      {/* How It Works — 4 numbered steps with arrow flow */}
      <section className="space-y-6">
        <SectionHead number="01" label="How it works" />
        <ol className="space-y-5">
          <Step
            n="01"
            title="Paste a claim"
            body="Anything from a viral social-media post to a campaign ad to a sentence in a news article. One sentence to a paragraph works."
          />
          <StepArrow />
          <Step
            n="02"
            title="Proofiness builds the case file"
            body="Decomposes the claim into atomic sub-claims. Searches the web with deliberately varied framings (a direct countermeasure to confirmation bias). Traces citations upstream toward primary sources. Builds the strongest case for and against each sub-claim."
          />
          <StepArrow />
          <Step
            n="03"
            title="Read the assessment"
            body="One of six calibrated labels (largely supported / largely contradicted / mixed / definitional / value-laden / insufficient evidence) plus a low/moderate/high confidence dial plus a one- or two-sentence synthesis. The 30-second answer."
          />
          <StepArrow />
          <Step
            n="04"
            title="Disagree? Open the receipts"
            body="Every claim links to its source. Every assessment shows its work. The deep-path case file — sub-claims, sources with quality badges, steelman pairs, provenance chains — is one click away."
          />
        </ol>
      </section>

      {/* What's different — six-feature grid */}
      <section className="space-y-6">
        <SectionHead number="02" label="What's different" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Feature
            title="Calibrated, not binary"
            body="Six labels including 'definitional' and 'value-laden' for questions evidence cannot resolve. No Truth-O-Meter."
          />
          <Feature
            title="Multi-framing search"
            body="Three to four queries per sub-claim with deliberately varied framings — not just one Google. Built to fight SEO bubbles."
          />
          <Feature
            title="Provenance tracing"
            body="Walks citations upstream from secondary reporting toward the primary source the chain ends at. Many widely-repeated 'facts' trace back to one weak study."
          />
          <Feature
            title="Steelman both sides"
            body="Strongest case for and against each sub-claim, presented with the same care. Refuses to fabricate symmetry when sources don't support it."
          />
          <Feature
            title="Open-source prompts"
            body="Every LLM prompt is a versioned text file in the repo. If you suspect bias, read them. If you'd run a different methodology, fork it."
          />
          <Feature
            title="No accounts, no tracking"
            body="Local SQLite database. No analytics. No cookies. Three named third parties (Anthropic, Tavily, source publishers); see Privacy."
          />
        </div>
      </section>

      {/* Sample assessment — what an output actually looks like */}
      <section className="space-y-6">
        <SectionHead number="03" label="What an assessment looks like" />
        <SampleDossier />
        <p className="text-center font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
          Illustration · not an interactive dossier
        </p>
      </section>

      {/* Why it exists — short narrative */}
      <section className="space-y-6">
        <SectionHead number="04" label="Why it exists" />
        <div className="border border-stone-300 bg-white p-6 sm:p-8">
          <div className="space-y-4 font-serif text-base leading-relaxed text-stone-800">
            <p>
              The information environment is increasingly hostile to objective truth.
              Misinformation spreads faster than the corrections that follow it. Centralized
              fact-checking has credibility problems with significant chunks of the population —
              partly justified, partly not. AI tools that pronounce confident verdicts on
              contested claims can pollute the environment as much as they help it.
            </p>
            <p>
              Proofiness tries to thread that needle. Each dossier opens with a calibrated
              assessment — not a binary verdict — backed by the actual sources, structured so
              you can see where the assessment is grounded and where it might be wrong.
            </p>
            <p className="border-l-2 border-accent bg-stone-50 px-4 py-3 italic">
              The fast path is the 30-second answer. The deep path is the 5-minute case file
              you use to argue with the assessment when you disagree. <span className="not-italic font-display font-bold uppercase tracking-widish text-accent">You judge.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA — repeated */}
      <section className="space-y-4 border-t-2 border-ink pt-10">
        <p className="text-center font-display text-2xl font-bold uppercase tracking-widish text-ink sm:text-3xl">
          Ready to test a claim?
        </p>
        <PrimaryCTA />
      </section>
    </div>
  );
}

// ─── Primary CTA, used twice ─────────────────────────────────────────────────
function PrimaryCTA() {
  return (
    <div className="flex justify-center">
      <a
        href={APP_HASH}
        className="inline-block border-2 border-ink bg-ink px-8 py-4 font-display text-base font-bold uppercase tracking-widish text-stone-50 shadow-[4px_4px_0_0_#92400e] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#92400e] sm:text-lg"
      >
        Open the App →
      </a>
    </div>
  );
}

// ─── Section head — bigger and warmer than the in-app SectionHeader ─────────
function SectionHead({ number, label }: { number: string; label: string }) {
  return (
    <div className="space-y-2">
      <p className="font-mono text-xs uppercase tracking-widest text-stone-500">
        Section {number}
      </p>
      <h2 className="font-display text-2xl font-bold uppercase tracking-widish text-ink sm:text-3xl">
        {label}
      </h2>
      <div className="h-px bg-stone-300" />
    </div>
  );
}

// ─── Numbered step block with title + body ──────────────────────────────────
function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-5 border border-stone-300 bg-white p-5 sm:gap-6 sm:p-6">
      <span className="shrink-0 font-mono text-2xl font-bold text-stone-400 sm:text-3xl">
        {n}
      </span>
      <div className="space-y-2">
        <h3 className="font-display text-lg font-bold text-ink sm:text-xl">{title}</h3>
        <p className="font-serif text-base leading-relaxed text-stone-800">{body}</p>
      </div>
    </li>
  );
}

function StepArrow() {
  return (
    <li className="flex justify-center" aria-hidden="true">
      <span className="font-mono text-2xl text-stone-400">↓</span>
    </li>
  );
}

// ─── Feature card for the differentiator grid ───────────────────────────────
function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-stone-300 bg-white p-5">
      <h3 className="font-display text-base font-bold text-ink">{title}</h3>
      <p className="mt-2 font-serif text-sm leading-relaxed text-stone-800">{body}</p>
    </div>
  );
}

// ─── Sample dossier — a faux assessment showing what an output looks like ──
// Politically neutral example (chocolate / cognition) so the demo doesn't
// inadvertently advertise a partisan prior. Generic source-attribution language
// (no specific authors cited) so the example doesn't make falsifiable claims
// the real dossier would have to back up.
function SampleDossier() {
  return (
    <article className="border border-stone-400 bg-stone-50">
      <div className="h-[3px] bg-accent" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 bg-white px-5 py-2">
        <span className="font-display text-xs font-bold uppercase tracking-widish text-ink">
          Assessment · sample
        </span>
        <ConfidenceDialMock />
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <p className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
            Original claim
          </p>
          <p className="mt-1 font-serif text-base italic leading-relaxed text-stone-700">
            Eating dark chocolate improves cognitive performance.
          </p>
        </div>
        <p className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
          Mixed — hinges on the magnitude of acute cognitive effects from cocoa flavanols
        </p>
        <p className="font-serif text-base leading-relaxed text-stone-800">
          Several short-term controlled trials show small acute improvements in attention and
          processing speed after high-flavanol cocoa consumption. Long-term effects remain
          contested in the literature — meta-analyses note small effect sizes, heterogeneous
          study designs, and possible publication bias.
        </p>
        <div className="border-t border-stone-300 pt-3">
          <p className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
            ↓ Real dossiers continue with sub-claims, source list, steelman pairs,
            contestation labels, provenance chains, and the crux.
          </p>
        </div>
      </div>
    </article>
  );
}

// Static version of the in-app ConfidenceDial — three dots, two filled.
function ConfidenceDialMock() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="font-mono text-[0.65rem] uppercase tracking-widish text-stone-600">
        Confidence
      </span>
      <span className="flex items-center gap-0.5">
        <Dot filled />
        <Dot filled />
        <Dot />
      </span>
      <span className="font-mono text-[0.65rem] uppercase tracking-widish text-ink">
        moderate
      </span>
    </div>
  );
}

function Dot({ filled }: { filled?: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full border border-ink ${
        filled ? "bg-ink" : "bg-transparent"
      }`}
    />
  );
}

// Suppress "unused" warning if any import isn't reached.
export const __dummy: ReactNode = null;
