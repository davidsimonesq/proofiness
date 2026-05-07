// Spec §9 — surface the limits, don't bury them. Persistent on every dossier view.
export function LimitsDisclosure() {
  return (
    <details className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
      <summary className="cursor-pointer font-semibold text-amber-900">
        What Crux can and can't do
      </summary>
      <div className="mt-2 space-y-2 text-amber-900/90">
        <p>
          Crux works best on <strong>specific, decomposable factual claims</strong> — vote counts,
          study findings, dates, named events, named people. It works progressively worse as you
          move toward broad narrative claims ("immigration is hurting the economy") or values
          questions ("was this policy good").
        </p>
        <p>
          Crux is only as good as what's on the indexed web. For genuinely cutting-edge or actively
          contested topics, the dossier will reflect biases in search rankings and source
          availability.
        </p>
        <p>
          Crux uses an AI model that can generate confident-sounding wrong synthesis. The dossier
          links every claim to a source for a reason: <strong>don't trust the synthesis, check the
          sources</strong>.
        </p>
        <p>
          Crux does not give you a verdict. That's a feature, not a bug. Pronouncements are how the
          information environment got polluted in the first place.
        </p>
      </div>
    </details>
  );
}
