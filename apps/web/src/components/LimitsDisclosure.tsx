// Spec §9 — surface the limits, don't bury them. Persistent on every dossier.
// Renders as marginalia: hairline-bordered, italic prose, lower visual weight
// than the main dossier surfaces but always present.
//
// NOTE: this copy was rewritten when the project moved from "no verdict, by
// design" to "calibrated assessment with full receipts." The disclaimers are
// now about what the AI can wrongly assess, not about what it deliberately
// doesn't say. The spec §9 spirit ("be honest about what the tool can't do")
// is unchanged.
export function LimitsDisclosure() {
  return (
    <details className="border border-stone-300 border-l-2 border-l-accent bg-stone-50">
      <summary className="cursor-pointer px-4 py-2 font-display text-xs font-semibold uppercase tracking-widish text-accent hover:bg-stone-100">
        ⓘ &nbsp; What Proofiness can and can't do
      </summary>
      <div className="space-y-3 border-t border-stone-300 p-4 font-serif text-sm leading-relaxed text-stone-800">
        <p>
          Proofiness does best with <span className="font-semibold">specific, decomposable factual
          claims</span> — vote counts, study findings, dates, named events, named people. It
          does progressively worse as you move toward broad narrative claims ("immigration is
          hurting the economy") or values questions ("was this policy good?"). On those, its assessment will often come back as <span className="font-mono">definitional</span> or{" "}
          <span className="font-mono">value-laden</span>. That's the app telling you the question
          isn't the kind it can resolve.
        </p>
        <p>
          The app's assessment is only as good as what's on the indexed web. For genuinely cutting-edge or actively contested topics, the assessment may shift if better sources are available tomorrow. For topics where the literature is one-sided in public-facing sources but contested in specialist literature, the assessment may underweight the contested side.
        </p>
        <p>
          Proofiness uses an AI model that can generate <span className="font-semibold">confident-sounding wrong
          assessments</span>. But the assessment is a starting point &mdash; not the end. Every claim links to its sources for a reason: when the assessment doesn't feel grounded, expand the case file and check the sources directly.
        </p>
        <p className="border-l-2 border-accent bg-white px-3 py-2 not-italic">
          <span className="font-display font-bold uppercase tracking-widish text-accent">
            What this isn't:
          </span>{" "}
          a single AI opinion based on training. The assessment isn't the model telling you what
          it remembers about your claim &mdash; it's built fresh from web searches run with
          deliberately varied framings (a direct counter to confirmation bias), the actual
          articles those searches returned, and a strongest-case-for-and-against built from
          those sources. The AI here is reading and synthesizing &mdash; not remembering.
        </p>
        <p className="border-l-2 border-accent bg-white px-3 py-2 not-italic">
          <span className="font-display font-bold uppercase tracking-widish text-accent">
            What this isn't:
          </span>{" "}
          a fact-checker badge. The assessment is a calibrated call from the available sources &mdash; not a final pronouncement. The confidence dial and the deep-path case file are there so you can see when to trust it and when to push back.
        </p>
      </div>
    </details>
  );
}
