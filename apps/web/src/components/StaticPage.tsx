import type { ReactNode } from "react";
import type { StaticPageSlug } from "../lib/route.js";
import { SectionHeader } from "../App.js";

interface Props {
  slug: StaticPageSlug;
}

const TITLES: Record<StaticPageSlug, string> = {
  about: "About Proofiness",
  privacy: "Privacy Policy",
  terms: "Terms of Use",
  help: "How To Read Your Results",
};

const NUMBERS: Record<StaticPageSlug, string> = {
  about: "A",
  privacy: "P",
  terms: "T",
  help: "H",
};

// Real content for the footer pages. Honest about the project's developer-stage
// status; accurate to how the code actually works today; written so a real
// early-stage user has the information they need (about, help) and a real
// pre-launch reviewer can use it as a starting point (privacy, terms).
export function StaticPage({ slug }: Props) {
  return (
    <article className="space-y-8">
      <a
        href="#/"
        className="inline-block font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
      >
        ← Home
      </a>

      <SectionHeader number={NUMBERS[slug]} label={TITLES[slug]} />

      <div className="border border-stone-300 bg-white p-6 sm:p-8">
        {slug === "about" && <AboutContent />}
        {slug === "privacy" && <PrivacyContent />}
        {slug === "terms" && <TermsContent />}
        {slug === "help" && <HelpContent />}
      </div>
    </article>
  );
}

// ─── Typographic primitives ──────────────────────────────────────────────────
function Para({ children }: { children: ReactNode }) {
  return <p className="font-serif text-base leading-relaxed text-stone-800">{children}</p>;
}

function Subhead({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-7 font-display text-sm font-bold uppercase tracking-widish text-ink first:mt-0">
      {children}
    </h3>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.85em] text-ink">{children}</code>;
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 font-serif text-base leading-relaxed text-stone-800">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function LastUpdated({ date }: { date: string }) {
  return (
    <p className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
      Last updated · {date}
    </p>
  );
}

function CounselNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-accent bg-stone-50 px-3 py-2 font-serif text-sm italic leading-relaxed text-stone-700">
      <span className="font-display not-italic font-bold uppercase tracking-widish text-accent">
        Note
      </span>{" "}
      — {children}
    </p>
  );
}

// ─── About ───────────────────────────────────────────────────────────────────
function AboutContent() {
  return (
    <div className="space-y-4">
      <Subhead>What the app is</Subhead>
      <Para>
        Proofiness is an open-source civic fact-verification tool. Enter a factual claim — anything
        from a viral social-media post to a campaign ad to a sentence in a news article — and
        Proofiness will break it into atomic sub-claims, search the web with deliberately varied
        framings (a direct countermeasure to confirmation bias), trace citations upstream toward
        primary sources, build the strongest case for and against each sub-claim, identify
        what the answer actually hinges on, and return a calibrated, plain-language assessment
        with a full dossier behind it.
      </Para>

      <Subhead>Why "Proofiness"?</Subhead>
      <Para>
        The term was coined by Charles Seife, an NYU journalism professor and
        mathematician, in his 2010 book{" "}
        <a
          href="https://en.wikipedia.org/wiki/Proofiness"
          target="_blank"
          rel="noopener noreferrer"
          className="italic text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          Proofiness: The Dark Arts of Mathematical Deception
        </a>
        . Seife defines it as <span className="italic">"the art of using bogus
        mathematical arguments to prove something that you know in your heart is
        true &mdash; even when it's not."</span>
      </Para>
      <Para>
        This app is named for the phenomenon it tries to push back against: confident-sounding assertions that look like proof but aren't. Every Proofiness assessment includes a dossier showing exactly the proof it's based on.
      </Para>

      <Subhead>Why it exists</Subhead>
      <Para>
        The information environment is increasingly hostile to objective truth. Misinformation
        spreads faster than the corrections that follow it. Centralized fact-checking has
        credibility problems with significant chunks of the population — partly justified, partly
        not. AI tools that pronounce confident verdicts on contested claims can pollute the
        environment as much as they help it.
      </Para>
      <Para>
        Proofiness tries to thread that needle. Its calibrated assessment is not a binary verdict; it's backed by the actual sources, structured so you can see where the assessment is grounded and where it might be wrong. The fast path is the 30-second answer. The deep path is the 5-minute case file you can use to argue with the assessment if you disagree.
      </Para>

      <Subhead>How an assessment is built</Subhead>
      <Para>Each assessment runs through a 10-step pipeline:</Para>
      <Bullets
        items={[
          <>Normalize the claim (refuse vague inputs with refinement suggestions).</>,
          <>Decompose into atomic sub-claims, each tagged by type.</>,
          <>Search the web with 3–4 different framings per sub-claim, in parallel.</>,
          <>Fetch and extract clean text from the top results; detect paywalls.</>,
          <>Classify each source by type (peer-reviewed, government, advocacy, etc.).</>,
          <>Trace citations upstream from secondary reporting toward primary sources.</>,
          <>Build the strongest case for and against each sub-claim from the available sources.</>,
          <>Label where the disagreement sits (settled / contested-with-evidence / etc.).</>,
          <>Identify which sub-claims would flip the answer if resolved differently.</>,
          <>Synthesize the top-line assessment with calibrated confidence.</>,
        ]}
      />

      <Subhead>Open source, open methodology</Subhead>
      <Para>
        The full source code, the LLM prompts that drive each step, and the curated source-quality
        rules are all on GitHub. This matters because the assessment is only as trustworthy as the
        process that produced it. If you suspect bias, you can read the prompts. If you want to
        propose a different methodology, you can fork it.
      </Para>
      <Para>
        Repository:{" "}
        <a
          href="https://github.com/davidsimonesq/proofiness"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          github.com/davidsimonesq/proofiness
        </a>
      </Para>

      <Subhead>i-Resist Civic Tech Suite</Subhead>
      <Para>
        Proofiness is part of the i-Resist civic tech suite — a small collection of independent
        tools aimed at helping engaged citizens navigate the contemporary information environment
        without ceding judgment to either partisan media or centralized authorities.
      </Para>

      <Subhead>Contact</Subhead>
      <Para>
        General questions, press inquiries, and partnership requests:{" "}
        <ContactEmail />. Bug reports, design feedback, prompt-balance audits, and pull requests
        are best filed as issues in the GitHub repository.
      </Para>
    </div>
  );
}

// Anchor for the project's primary contact email. Centralized so all three
// pages reference the same address; change once if it ever needs updating.
function ContactEmail() {
  return (
    <a
      href="mailto:info@proofiness.org"
      className="font-mono text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
    >
      info@proofiness.org
    </a>
  );
}

// ─── Privacy ─────────────────────────────────────────────────────────────────
function PrivacyContent() {
  return (
    <div className="space-y-4">
      <LastUpdated date="2026-05-08" />

      <CounselNote>
        Proofiness is currently a single-user, locally-hosted tool. This policy
        describes how the open-source distribution works as shipped from the repository. Any
        deployed instance (multi-user, hosted, or commercial) <strong>must publish its own
        privacy notice</strong> describing what changes.
      </CounselNote>

      <Subhead>1. Summary</Subhead>
      <Para>
        Proofiness does not run analytics. It does not set tracking cookies. It does not create
        user accounts. The data you submit (the claim text, optional context) is processed locally
        and sent to a small number of named third parties (Anthropic, Tavily, source publishers)
        as part of producing an assessment. Your assessment history is stored only on the machine
        running the API.
      </Para>

      <Subhead>2. What data is collected</Subhead>
      <Para>When you submit a claim, Proofiness handles the following data:</Para>
      <Bullets
        items={[
          <>
            <strong>The claim text</strong> you typed or pasted into the input field.
          </>,
          <>
            <strong>Optional context</strong> if you provided it (where you encountered the
            claim, what surrounded it).
          </>,
          <>
            <strong>The full assessment + dossier output</strong> — sub-claims, sources, steelman
            pairs, contestation labels, crux summary, and the top-line assessment itself.
          </>,
          <>
            <strong>A unique assessment ID</strong> (UUID) and a timestamp.
          </>,
        ]}
      />
      <Para>
        Proofiness does <strong>not</strong> collect: your name, email, IP address, geolocation,
        device fingerprint, browsing history outside Proofiness, or any analytics data.
      </Para>

      <Subhead>3. Where data is stored</Subhead>
      <Para>
        Assessments are stored in a local SQLite database file on the machine running the Proofiness
        API server. By default this is <Code>apps/api/data/proofiness.db</Code>. On the hosted
        instance at proofiness.org, the database lives on a Railway volume at{" "}
        <Code>/data/proofiness.db</Code> and is included in that platform's standard volume
        snapshots. The database is not transmitted off the host machine and is not synced to any
        cloud service by Proofiness itself. If the host machine is backed up, the assessments will
        be backed up with it.
      </Para>
      <Para>
        Cached fetches of source articles and source-classification decisions are kept in memory
        only (LRU caches with TTLs of one hour and 24 hours respectively); they do not
        persist across server restarts.
      </Para>

      <Subhead>4. Third-party processors</Subhead>
      <Para>
        Every assessment triggers calls to the following third parties. Each has its own privacy
        practices governing what it does with the data we send.
      </Para>
      <Bullets
        items={[
          <>
            <strong>Anthropic</strong> — the language model provider. Receives the submitted
            claim, the sub-claims derived from it, the source content (titles + extracted text
            snippets) retrieved for it, and intermediate outputs (steelman pairs, crux, etc.).
            Used for all generative steps (decomposition, classification, steelman-generation,
            contestation-labeling, crux-identification, and the top-line assessment). See
            anthropic.com/legal for its privacy practices.
          </>,
          <>
            <strong>Tavily</strong> — the web-search provider. Receives search queries derived
            from the claim. See tavily.com for its privacy practices.
          </>,
          <>
            <strong>Source publishers</strong> — when Proofiness fetches the full text of an
            article to extract clean content or trace citations, it sends an HTTP request directly
            to the publisher's server. The request identifies itself via a User-Agent string
            pointing at the Proofiness GitHub repository. The publisher will see the request in
            their own server logs.
          </>,
        ]}
      />

      <Subhead>5. User-supplied API keys (BYOK)</Subhead>
      <Para>
        Proofiness offers an optional "bring your own keys" mode (Settings →{" "}
        <a
          href="#/settings"
          className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          Use my own keys
        </a>
        ). When you supply your own Anthropic and Tavily keys:
      </Para>
      <Bullets
        items={[
          <>
            The keys are stored only in your browser's local storage. They are{" "}
            <strong>never</strong> sent to a Proofiness database or written to disk.
          </>,
          <>
            They are sent with each assessment request as HTTP headers
            (<Code>x-anthropic-key</Code> and <Code>x-tavily-key</Code>) over TLS.
          </>,
          <>
            The server uses them in memory for the duration of that single request to call
            Anthropic and Tavily on your behalf, then discards them. They are{" "}
            <strong>not logged</strong> in any access log, error log, or request trace.
          </>,
          <>
            <strong>Anthropic and Tavily will then bill your accounts directly</strong> for the
            calls. The server keys embedded in the app will no longer be used.
          </>,
          <>
            Clearing your keys (Settings → Clear my keys) removes them from local storage
            immediately; subsequent requests revert to the embedded-key path.
          </>,
        ]}
      />

      <Subhead>6. Cookies and tracking</Subhead>
      <Para>
        Proofiness sets no cookies. No analytics scripts (Google Analytics, Plausible, etc.) are
        loaded. The only third-party network request initiated by the web app itself is to
        Google Fonts to load the IBM Plex font family used in the UI; no other content from
        Google is loaded, and no Google cookies are set as a result.
      </Para>

      <Subhead>7. Sharing</Subhead>
      <Para>
        The "Share" button on an assessment copies a URL to your clipboard. The URL points at the
        assessment's permalink on the Proofiness instance you are using. No tracking parameters are
        attached. No analytics fire when a recipient opens the link. Whether the recipient can
        reach the URL depends on whether your instance is publicly accessible.
      </Para>

      <Subhead>8. Your rights and controls</Subhead>
      <Para>
        Because Proofiness as shipped is a single-user local tool, you have direct control over
        all the data: the SQLite database file is on your machine, and you can inspect, export,
        or delete it at will. To delete your entire history, delete the database file
        (<Code>apps/api/data/proofiness.db</Code>) and restart the API server, which will create
        a fresh empty database. To delete a single assessment, use the "Delete" control on the
        assessment view (next to "Share") or the per-row delete in the history list. Both are
        gated by the invite code that created the assessment, so the browser holding that code is
        the only one that can authorize the removal.
      </Para>

      <Subhead>9. Children</Subhead>
      <Para>
        Proofiness is not directed at children under 13 and is not designed for use by them.
      </Para>

      <Subhead>10. Security</Subhead>
      <Para>
        For local single-user use, the security boundary is the host machine. The API binds to
        127.0.0.1 by default and is not exposed to the network. The SQLite database is a regular
        file with the host's standard file permissions. API keys (Anthropic, Tavily) are stored
        in <Code>apps/api/.env</Code>, which is gitignored and not transmitted off the host.
      </Para>

      <Subhead>11. Hosted instance at proofiness.org</Subhead>
      <Para>
        The hosted instance at proofiness.org runs the open-source code described above with the
        following additional behaviors that the local-use defaults do not cover:
      </Para>
      <Bullets
        items={[
          <>
            <strong>IP addresses are seen transiently</strong> by the per-IP rate limiter (5
            assessment requests per minute) and by the platform's standard request logs. The
            application itself does not write IP addresses to the assessment database. Platform
            logs are retained per Railway's defaults (typically 7–30 days) and are not used
            for analytics.
          </>,
          <>
            <strong>Invite-code usage is recorded</strong> in the local SQLite database — one
            row per (code, day, count) — to enforce the lifetime quota. Codes are short opaque
            strings and are not linked to identities unless you tell us who you are when
            requesting one.
          </>,
          <>
            <strong>Assessments persist server-side</strong> in the database at{" "}
            <Code>/data/proofiness.db</Code> on a Railway volume. Anyone who knows an assessment's
            UUID URL can read it; treat assessment URLs as semi-public. Assessments you created via
            an invite code can be deleted from the assessment view or the history list — the
            delete is gated by that same code, so only your browser can authorize it. For
            bulk deletion across an invite code (e.g., remove everything I ever generated),
            email <ContactEmail />.
          </>,
          <>
            <strong>BYOK requests skip the invite-code quota entirely</strong> (no usage row
            is written). The resulting assessment is saved to the server-side database the same
            way as any other assessment; because no invite code is on file, the web client can't
            authorize a delete on it — email <ContactEmail /> for removal.
          </>,
        ]}
      />

      <Subhead>12. Changes to this policy</Subhead>
      <Para>
        Material changes to this policy will be reflected in the "Last updated" date at the top
        of this page and announced in the GitHub repository's release notes. For deployed
        instances under separate stewardship, the operator should publish their own change log.
      </Para>

      <Subhead>13. Contact</Subhead>
      <Para>
        Privacy questions, data-access requests, and deletion requests:{" "}
        <ContactEmail />. Technical questions and bug reports are also welcome as issues on
        the GitHub repository. For deployed instances under separate stewardship, the operator
        should publish a contact channel of their own.
      </Para>
    </div>
  );
}

// ─── Terms ───────────────────────────────────────────────────────────────────
function TermsContent() {
  return (
    <div className="space-y-4">
      <LastUpdated date="2026-05-08" />

      <CounselNote>
        These Terms apply to the open-source Proofiness project as shipped from its GitHub
        repository. If you operate a deployed instance — multi-user, hosted, or commercial —
        <strong> you should publish your own Terms</strong> reflecting your jurisdiction, your
        contractual relationship with users, and any commercial arrangements.
      </CounselNote>

      <Subhead>1. Acceptance</Subhead>
      <Para>
        By accessing or using Proofiness ("the Service"), you agree to these Terms of Use. If
        you do not agree, do not use the Service.
      </Para>

      <Subhead>2. Description of Service</Subhead>
      <Para>
        Proofiness is an automated, AI-powered fact-verification tool that produces structured
        evidence dossiers and calibrated assessments from web-search results. The Service is
        provided <strong>as-is, for informational and research purposes only</strong>. It is not
        a fact-checking service, a journalism outlet, or a licensed advisory of any kind.
      </Para>
      <Para>
        Access to the hosted instance at proofiness.org is rate-limited (per IP) and
        quota-gated (per invite code, lifetime). Specific quotas, rate limits, and gating
        mechanisms may change without notice. If a request is refused for quota or rate-limit
        reasons, the API returns a structured error response with the reason. Users may bypass
        the cost gate by supplying their own Anthropic and Tavily API keys; see the Privacy
        Policy for the details of how user-supplied keys are handled.
      </Para>

      <Subhead>3. AI accuracy disclaimer</Subhead>
      <Para>
        The assessments and synthesis produced by Proofiness are generated by large language
        models reading web-search results and source articles. <strong>These outputs may be
        wrong</strong> — they may contain factual errors, misclassifications, mischaracterizations
        of sources, biased framings, or hallucinated citations. The confidence dial is a
        calibrated signal &mdash; not a guarantee. The dossier underneath every assessment exists for
        a reason: when an assessment doesn't feel right, you are expected to expand it and check
        the sources directly.
      </Para>
      <Para>
        Do <strong>not</strong> rely on Proofiness for life-impacting decisions — medical,
        legal, financial, safety, voting, or otherwise — without independent verification from
        qualified human sources.
      </Para>

      <Subhead>4. Acceptable use</Subhead>
      <Para>You agree not to use the Service to&nbsp;&mdash;</Para>
      <Bullets
        items={[
          <>Submit content that is unlawful, harassing, defamatory, or threatening.</>,
          <>
            Submit personal information about identifiable third parties without lawful basis.
          </>,
          <>Attempt to overwhelm, disrupt, or extract abnormal volumes from the Service.</>,
          <>
            Strip Proofiness assessments from their associated case files when sharing them, or
            present an assessment as a final verdict without the surrounding context.
          </>,
          <>Use the Service to generate content for the purpose of misleading others.</>,
        ]}
      />

      <Subhead>5. No warranty</Subhead>
      <Para>
        THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND,
        EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR ACCURACY OF THE
        INFORMATION OR ASSESSMENTS PROVIDED.
      </Para>

      <Subhead>6. Limitation of liability</Subhead>
      <Para>
        TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE AUTHORS,
        CONTRIBUTORS, OR OPERATORS OF PROOFINESS BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR
        GOODWILL, ARISING OUT OF OR RELATING TO YOUR USE OF OR INABILITY TO USE THE SERVICE,
        WHETHER BASED ON WARRANTY, CONTRACT, TORT, OR ANY OTHER LEGAL THEORY, AND WHETHER OR
        NOT THE AUTHORS HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
      </Para>

      <Subhead>7. Intellectual property</Subhead>
      <Para>
        The Proofiness source code is open-source under the license declared in the repository's
        <Code>LICENSE</Code> file. The claims you submit remain yours; the assessments Proofiness
        produces from them are made available to you for your own use. Source content fetched
        from third-party publishers remains subject to those publishers' rights and licenses.
        Proofiness fetches and extracts text under fair-use principles for the purpose of
        producing the assessments.
      </Para>

      <Subhead>8. Third-party services</Subhead>
      <Para>
        The Service relies on third-party APIs (Anthropic, Tavily) and on direct fetches from
        source publishers. Those third parties have their own terms governing their relationship
        with you and with the operator of the Service. The authors of Proofiness do not control
        and are not responsible for those third-party terms.
      </Para>

      <Subhead>9. Modifications</Subhead>
      <Para>
        These Terms may be updated. Material changes will be reflected in the "Last updated"
        date and the GitHub release notes. Continued use of the Service after changes
        constitutes acceptance of the updated Terms.
      </Para>

      <Subhead>10. Termination</Subhead>
      <Para>
        You may stop using the Service at any time and delete any local data as described in the
        Privacy Policy. The authors of Proofiness may discontinue or modify the open-source
        project at any time without notice.
      </Para>

      <Subhead>11. Governing law</Subhead>
      <Para>
        These Terms are governed by the laws of the State of California, United States, without
        regard to conflict-of-laws principles. Any deployed instance under separate stewardship
        should publish a governing-law clause appropriate to its operator's jurisdiction.
      </Para>

      <Subhead>12. Contact</Subhead>
      <Para>
        Legal notices and questions about these Terms: <ContactEmail />. Non-legal feedback and
        bug reports are also welcome as issues on the GitHub repository. For deployed instances
        under separate stewardship, the operator should publish a contact channel of their own.
      </Para>
    </div>
  );
}

// ─── Help ────────────────────────────────────────────────────────────────────
function HelpContent() {
  return (
    <div className="space-y-4">
      <Subhead>The fast path</Subhead>
      <Para>
        Every assessment opens with a label (one of six), a confidence dial (low / moderate /
        high), and a one- or two-sentence synthesis. Read these &mdash; they are the 30-second
        answer.
      </Para>

      <Subhead>What the labels mean</Subhead>
      <Bullets
        items={[
          <>
            <Code>Largely supported</Code> — the available evidence consistently supports the
            claim. The for-case is substantively heavier than the against-case.
          </>,
          <>
            <Code>Largely contradicted</Code> — mirror image of the above.
          </>,
          <>
            <Code>Mixed — hinges on …</Code> — both sides have substantive support; the answer
            depends on resolving a specific contested point.
          </>,
          <>
            <Code>Definitional — depends on what you mean by …</Code> — the empirical core is
            settled, but the conclusion turns on how a contested word is defined.
          </>,
          <>
            <Code>Value-laden</Code> — fundamentally a values question; evidence cannot resolve
            it.
          </>,
          <>
            <Code>Insufficient evidence</Code> — the dossier doesn't contain enough qualified
            sources to make a call.
          </>,
        ]}
      />

      <Subhead>The confidence dial</Subhead>
      <Para>
        Three filled dots = high confidence. Multiple peer-reviewed or government sources
        concur, the against-case in the steelman is empty or weak, and you'd be surprised to
        find the assessment wrong.
      </Para>
      <Para>
        Two filled dots = moderate confidence. Meaningful evidence in the indicated direction
        with caveats — smaller source base, one major dissenting peer-reviewed source, mixed
        source types, or a substantive contested sub-claim. This is the default for most
        contested topics.
      </Para>
      <Para>
        One filled dot = low confidence. Thin evidence base, sources mostly advocacy or
        single-domain, secondary reporting without primary-source provenance. Treat the
        assessment as a starting point and not a settled call.
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
        Open the case file. Check these three things, in order:
      </Para>
      <Bullets
        items={[
          <>
            <strong>Source classifications.</strong> Are there peer-reviewed studies that should
            have been weighted more heavily? Are advocacy sources being weighted as if they
            were independent research? The badges next to each source show what type Proofiness
            classified it as.
          </>,
          <>
            <strong>The steelman against-case.</strong> Does it identify a genuine weakness in
            the for-case, or is it being downplayed? Does it cite specific sources, or does it
            wave at a generic "some critics argue..."?
          </>,
          <>
            <strong>The provenance chain.</strong> For sources that are secondary reporting,
            the chain shows what they're actually citing. Many widely repeated "facts" trace
            back to a single weak study. If the chain ends at a primary source you can read,
            read it.
          </>,
        ]}
      />
      <Para>
        When you find a real disagreement with the assessment, these source links are the
        receipts you're disagreeing with.
      </Para>

      <Subhead>Using your own API keys</Subhead>
      <Para>
        Each invite code is capped at a fixed number of free assessments. When you've used
        your allotment, the app refuses further requests on that code. To create more assessments, supply your own Anthropic and Tavily API keys in{" "}
        <a
          href="#/settings"
          className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          Settings
        </a>
        . Both keys are required together. Once set,
        you can assess an unlimited number of claims, and Anthropic and Tavily will bill you directly. If you don't already have keys, sign up at console.anthropic.com and
        tavily.com. Keys live only in your browser's local storage, are sent per-request, and are never stored on the server. See{" "}
        <a
          href="#/privacy"
          className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          Privacy
        </a>{" "}
        §5 for the details.
      </Para>

      <Subhead>Deleting an assessment</Subhead>
      <Para>
        From the assessment view, click "Delete" next to "Share" — or use the per-row delete in
        the history list. A confirm step protects against accidents; once deleted, the
        permalink stops working and there's no undo. Delete is gated by the invite code that
        created the assessment, so your browser only sees the delete controls for assessments it
        created. If you've switched browsers or cleared local storage, re-enter your code in{" "}
        <a
          href="#/settings"
          className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          Settings
        </a>{" "}
        first. Assessments created via your own API keys (BYOK) can't be deleted from the
        web.
      </Para>

      <Subhead>Common questions</Subhead>

      <Para>
        <strong>How long does an assessment take?</strong> A new assessment takes 1 to 3 minutes.
        The app is making real searches, fetching real sources, and running the LLM 10
        times. Subsequent assessments on overlapping topics are faster.
      </Para>

      <Para>
        <strong>Why didn't I get a clean "true" or "false"?</strong> Because most contested
        public claims don't resolve into "true" or "false"; they resolve into "definitional,"
        "mixed," or "value-laden." Forcing a binary verdict on those is what gets fact-checkers
        attacked from all sides. Proofiness's six labels are designed to admit the structure of
        the disagreement, rather than flatten it.
      </Para>

      <Para>
        <strong>Why are the prompts politically symmetric few-shots?</strong> Because the
        prompts are the place where bias would creep in. Each prompt that handles politically
        loaded labels (contestation, assessment) carries paired examples — left-coded and
        right-coded — chosen so that swapping one for the other wouldn't change how the prompt
        handles them. The prompts are open source; you can read them.
      </Para>

      <Para>
        <strong>What if the assessment changes if I run the same claim again?</strong> It might.
        Different searches return different top results; the LLM is non-deterministic at
        reasonable temperatures. If you get noticeably different assessments on re-runs, that's
        useful information — it usually means the evidence base is genuinely thin or contested.
        The confidence dial should already reflect this; if it doesn't, that's a calibration
        issue worth filing as a bug.
      </Para>

      <Para>
        <strong>Can I share an assessment without sharing the case file?</strong> The Share
        button copies a URL to the assessment's permalink, which includes both the assessment and
        the dossier. There's intentional friction (an acknowledgment checkbox) to discourage
        screenshot-as-verdict sharing, since stripping the case file from the assessment throws
        away the receipts.
      </Para>

      <Subhead>Reporting issues</Subhead>
      <Para>
        Bugs, prompt-balance concerns, miscalibrated assessments, and methodology suggestions
        are all welcome as GitHub issues. The repository is{" "}
        <a
          href="https://github.com/davidsimonesq/proofiness"
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
        >
          github.com/davidsimonesq/proofiness
        </a>
        .
      </Para>
    </div>
  );
}
