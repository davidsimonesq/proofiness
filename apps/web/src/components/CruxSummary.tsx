import type { Crux, SubClaim } from "@proofiness/shared-types";

interface Props {
  crux: Crux;
  subClaims: SubClaim[];
}

// The dossier-top declaration. Strongest visual element on the page —
// emphatic-bordered with the burnished-brass accent at the rule. The summary
// is rendered in serif italic to emphasize "considered prose," not "verdict."
export function CruxSummary({ crux, subClaims }: Props) {
  const hingeSubClaims = crux.hingesOn
    .map((id) => subClaims.find((sc) => sc.id === id))
    .filter((sc): sc is SubClaim => Boolean(sc));

  return (
    <section
      aria-label="Crux summary"
      className="border border-stone-400 bg-stone-50"
    >
      {/* Top accent rule — the only place burnished brass appears prominently. */}
      <div className="h-[3px] bg-accent" />
      <div className="border-b border-stone-300 bg-white px-5 py-2">
        <span className="pf-label-loud">What this hinges on</span>
      </div>
      <div className="space-y-5 p-5">
        <p className="font-serif text-base italic leading-relaxed text-ink">
          {crux.summary}
        </p>

        {hingeSubClaims.length > 0 && (
          <div className="border-t border-stone-300 pt-4">
            <ul className="space-y-2">
              {hingeSubClaims.map((sc) => (
                <li
                  key={sc.id}
                  className="flex gap-3 border-l-2 border-accent bg-white px-3 py-2"
                >
                  <span className="font-mono text-[0.7rem] uppercase tracking-widish text-accent">
                    Hinge
                  </span>
                  <p className="font-serif text-sm leading-relaxed text-ink">{sc.text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="border-t border-stone-300 pt-3 font-serif text-xs italic text-stone-600">
          This describes <span className="not-italic font-mono">where</span> the disagreement sits,
          not which side is right. You weigh the evidence below.
        </p>
      </div>
    </section>
  );
}
