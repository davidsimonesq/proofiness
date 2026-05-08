// Spec §9 — surface the limits, don't bury them. Persistent on every dossier.
// Renders as marginalia: hairline-bordered, italic prose, lower visual weight
// than the main dossier surfaces but always present.
export function LimitsDisclosure() {
  return (
    <details className="border border-stone-300 bg-stone-50">
      <summary className="cursor-pointer px-4 py-2 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:bg-stone-100 hover:text-ink">
        ⓘ &nbsp; What Proofiness can and can't do
      </summary>
      <div className="space-y-3 border-t border-stone-300 p-4 font-serif text-sm leading-relaxed text-stone-800">
        <p>
          Proofiness works best on <span className="font-semibold">specific, decomposable factual
          claims</span> — vote counts, study findings, dates, named events, named people. It
          works progressively worse as you move toward broad narrative claims ("immigration is
          hurting the economy") or values questions ("was this policy good").
        </p>
        <p>
          Proofiness is only as good as what's on the indexed web. For genuinely cutting-edge or
          actively contested topics, the dossier will reflect biases in search rankings and
          source availability.
        </p>
        <p>
          Proofiness uses an AI model that can generate confident-sounding wrong synthesis. The dossier
          links every claim to a source for a reason: <span className="font-semibold">don't
          trust the synthesis, check the sources</span>.
        </p>
        <p className="border-l-2 border-accent bg-white px-3 py-2 not-italic">
          <span className="font-display font-bold uppercase tracking-widish text-accent">
            By design:
          </span>{" "}
          Proofiness does not give you a verdict. Pronouncements are how the information environment
          got polluted in the first place.
        </p>
      </div>
    </details>
  );
}
