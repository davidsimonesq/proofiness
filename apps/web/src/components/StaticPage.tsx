import type { ReactNode } from "react";
import type { StaticPageSlug } from "../lib/route.js";
import { SectionHeader } from "../App.js";

interface Props {
  slug: StaticPageSlug;
}

const TITLES: Record<StaticPageSlug, string> = {
  about: "About Proofiness",
  privacy: "Privacy",
  terms: "Terms of Use",
  help: "How to Read a Dossier",
};

const NUMBERS: Record<StaticPageSlug, string> = {
  about: "A",
  privacy: "P",
  terms: "T",
  help: "H",
};

// Placeholder content that's actually accurate, not "coming soon" stubs. Real
// content reflecting how the project actually works today; can be revised as
// the product evolves.
export function StaticPage({ slug }: Props) {
  return (
    <article className="space-y-8">
      <a
        href="#/"
        className="inline-block font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
      >
        ← Index
      </a>

      <SectionHeader number={NUMBERS[slug]} label={TITLES[slug]} />

      <div className="border border-stone-300 bg-white p-6">
        {slug === "about" && <AboutContent />}
        {slug === "privacy" && <PrivacyContent />}
        {slug === "terms" && <TermsContent />}
        {slug === "help" && <HelpContent />}
      </div>
    </article>
  );
}

// Reusable typographic primitives matching the field-manual aesthetic.
function Para({ children }: { children: ReactNode }) {
  return <p className="font-serif text-base leading-relaxed text-stone-800">{children}</p>;
}

function Subhead({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-widish text-ink">
      {children}
    </h3>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.85em] text-ink">{children}</code>;
}

function AboutContent() {
  return (
    <div className="space-y-4">
      <Para>
        Proofiness is a civic fact-verification dossier tool. Paste a claim — anything from a
        viral social-media post to a campaign ad to a sentence in a news article — and Proofiness
        breaks it into atomic sub-claims, searches the web with deliberately varied framings,
        traces citations upstream toward primary sources, builds the strongest case for and
        against each sub-claim from those sources, identifies what the answer actually hinges on,
        and returns a calibrated, plain-language assessment with the full case file behind it.
      </Para>

      <Subhead>Why it exists</Subhead>
      <Para>
        Centralized fact-checking has credibility problems with significant chunks of the
        population, and AI tools that pronounce verdicts on contested claims can pollute the
        information environment as much as they help it. Proofiness tries to thread that needle
        by giving you a calibrated assessment (not a binary verdict) backed by the actual
        sources, structured so you can see where the assessment is grounded and where it might
        be wrong.
      </Para>

      <Subhead>How to use it</Subhead>
      <Para>
        Read the assessment first — it's the 30-second answer. The confidence dial tells you
        how heavily to weight it. When the assessment doesn't feel grounded, expand the case
        file: every claim links to its source, every steelman cites the specific arguments, every
        provenance chain shows what the article was actually leaning on. The deep path is one
        click away on every dossier.
      </Para>

      <Subhead>Source code + spec</Subhead>
      <Para>
        Open source on GitHub:{" "}
        <a
          href="https://github.com/davidsimonesq/proofiness"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          github.com/davidsimonesq/proofiness
        </a>
        . The original design spec, prompt files, and source-classification rules are all in
        the repo and open to scrutiny. The product is part of the i-Resist civic tech suite.
      </Para>
    </div>
  );
}

function PrivacyContent() {
  return (
    <div className="space-y-4">
      <Para>
        Proofiness is currently a single-user, locally-hosted tool. The summary below describes
        how it works in the dev configuration shipped from the repo. Any deployed instance
        should publish its own privacy notice describing what changes.
      </Para>

      <Subhead>What is stored</Subhead>
      <Para>
        Submitted claims and the dossiers generated from them are stored in a local SQLite
        database at <Code>apps/api/data/proofiness.db</Code> on the machine running the API.
        Nothing is sent to a remote analytics service, nothing is tracked across sessions, and
        no user accounts exist.
      </Para>

      <Subhead>Third-party calls</Subhead>
      <Para>
        Each dossier triggers calls to:
      </Para>
      <ul className="list-disc space-y-1 pl-6 font-serif text-base leading-relaxed text-stone-800">
        <li>
          <strong>Anthropic API</strong> — the LLM behind decomposition, classification,
          steelman, contestation, crux, and the top-line assessment. The submitted claim and
          the source content retrieved for it are sent to Anthropic. Anthropic's privacy policy
          governs that data.
        </li>
        <li>
          <strong>Tavily Search API</strong> — used for web search per sub-claim. Search
          queries (derived from the claim) are sent to Tavily. Tavily's policy applies.
        </li>
        <li>
          <strong>Source publishers</strong> — Proofiness fetches article pages directly from
          their hosts to extract clean text and trace citations. The fetch identifies itself
          via a User-Agent string pointing at this project's repo.
        </li>
      </ul>

      <Subhead>What is not stored</Subhead>
      <Para>
        No IP addresses, no analytics, no cookies. The local SQLite database holds dossiers
        only. The shared link feature copies a URL to the clipboard; no link-tracking is
        attached.
      </Para>
    </div>
  );
}

function TermsContent() {
  return (
    <div className="space-y-4">
      <Subhead>What you're looking at</Subhead>
      <Para>
        Proofiness is open-source civic tech provided as-is. Assessments are produced by AI
        models reading web search results and may be wrong. The dossier underneath every
        assessment exists for a reason: when the assessment doesn't feel right, expand it and
        check the sources.
      </Para>

      <Subhead>Use at your own risk</Subhead>
      <Para>
        Don't rely on Proofiness for life-impacting decisions (medical, legal, financial,
        safety) without independent verification from qualified sources. The assessment label
        and confidence dial are calibrated calls, not professional opinions.
      </Para>

      <Subhead>Sharing</Subhead>
      <Para>
        The share function intentionally adds friction — it requires explicit acknowledgment
        before generating a link. The link points at the structured dossier, not a verdict
        screenshot. Don't strip a Proofiness assessment from its case file when sharing.
      </Para>

      <Subhead>License</Subhead>
      <Para>
        See the LICENSE file in the source repository.
      </Para>
    </div>
  );
}

function HelpContent() {
  return (
    <div className="space-y-4">
      <Subhead>The fast path</Subhead>
      <Para>
        Every dossier opens with a single calibrated assessment: a label (one of six), a
        confidence dial (low / moderate / high), and a one- or two-sentence synthesis. Read
        these. They are the 30-second answer.
      </Para>

      <Subhead>What the labels mean</Subhead>
      <ul className="list-disc space-y-2 pl-6 font-serif text-base leading-relaxed text-stone-800">
        <li>
          <Code>Largely supported</Code> — the available evidence consistently supports the
          claim. The for-case is substantively heavier than the against-case.
        </li>
        <li>
          <Code>Largely contradicted</Code> — mirror image of the above.
        </li>
        <li>
          <Code>Mixed — hinges on …</Code> — both sides have substantive support; the answer
          depends on resolving a specific contested point named after the dash.
        </li>
        <li>
          <Code>Definitional — depends on what you mean by …</Code> — the empirical core is
          settled, but the conclusion turns on how a contested word is defined.
        </li>
        <li>
          <Code>Value-laden</Code> — fundamentally a values question; evidence cannot resolve it.
        </li>
        <li>
          <Code>Insufficient evidence</Code> — the dossier doesn't contain enough qualified
          sources to make a call.
        </li>
      </ul>

      <Subhead>The confidence dial</Subhead>
      <Para>
        Three filled dots = high confidence (multiple peer-reviewed or government sources concur,
        against-case is empty or weak). Two = moderate (meaningful evidence in the indicated
        direction with caveats). One = low (thin evidence base; treat the assessment as a
        starting point rather than a settled call).
      </Para>

      <Subhead>The deep path</Subhead>
      <Para>
        When the assessment doesn't feel grounded, click "View full dossier." You'll see every
        sub-claim with its sources, contestation label (where the disagreement sits), steelman
        pair (strongest case for and against), and provenance chain (citations traced upstream
        toward primary sources). The deep path is where you check Proofiness's work.
      </Para>

      <Subhead>What to do if the assessment seems wrong</Subhead>
      <Para>
        Open the case file. Check the source classifications: are there peer-reviewed studies
        that should have been weighted more heavily? Are advocacy sources being weighted as if
        they were research? Look at the steelman against-case: does it identify a genuine
        weakness in the for-case, or is it being downplayed? When you find a real disagreement
        with the assessment, the source links are the receipts you need to argue with it.
      </Para>
    </div>
  );
}
