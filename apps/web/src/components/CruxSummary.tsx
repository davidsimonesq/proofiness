import type { Crux, SubClaim } from "@crux/shared-types";

interface Props {
  crux: Crux;
  subClaims: SubClaim[];
}

// Renders the dossier-top "what does this hinge on" framing.
// CRITICAL: visually neutral. Not a verdict. Not a confidence indicator.
// The summary describes the SHAPE of disagreement, not which side is winning.
export function CruxSummary({ crux, subClaims }: Props) {
  const hingeSubClaims = crux.hingesOn
    .map((id) => subClaims.find((sc) => sc.id === id))
    .filter((sc): sc is SubClaim => Boolean(sc));

  return (
    <section
      aria-label="Crux summary"
      className="rounded border-l-4 border-l-slate-700 border border-slate-200 bg-white p-4 shadow-sm"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        What this hinges on
      </p>
      <p className="mt-1 text-sm text-slate-900">{crux.summary}</p>

      {hingeSubClaims.length > 0 && (
        <div className="mt-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {hingeSubClaims.length === 1 ? "Crux sub-claim" : "Crux sub-claims"}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {hingeSubClaims.map((sc) => (
              <li key={sc.id}>{sc.text}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs italic text-slate-500">
        This describes where the disagreement sits, not which side is right. You weigh the
        evidence below.
      </p>
    </section>
  );
}
