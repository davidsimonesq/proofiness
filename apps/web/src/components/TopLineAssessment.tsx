import type { Assessment, AssessmentConfidence, AssessmentLabel } from "@proofiness/shared-types";

interface Props {
  assessment: Assessment;
}

// The new dossier opener. Replaces "no verdict" with a calibrated, category-
// shaped call. Field-manual aesthetic — single accent rule + label + confidence
// glyphs + synthesis. NOT colorized true/false; the categories do that work.
//
// One thing this component DOES NOT do: green/red. Even with a verdict-shaped
// output, color encoding pushes toward the screenshot-as-verdict failure mode.
// The label text and the confidence glyphs are the indicators.

const LABEL_HEAD: Record<AssessmentLabel, string> = {
  largely_supported: "Largely supported",
  largely_contradicted: "Largely contradicted",
  mixed: "Mixed",
  definitional: "Definitional",
  value_laden: "Value-laden",
  insufficient_evidence: "Insufficient evidence",
};

// Three filled circles with a hairline frame around the inactive ones.
// Visual analogue to a calibration dial. No green/red.
const CONFIDENCE_FILLED: Record<AssessmentConfidence, number> = {
  low: 1,
  moderate: 2,
  high: 3,
};

const CONFIDENCE_LABEL: Record<AssessmentConfidence, string> = {
  low: "Low confidence",
  moderate: "Moderate confidence",
  high: "High confidence",
};

export function TopLineAssessment({ assessment }: Props) {
  const headline =
    (assessment.label === "mixed" || assessment.label === "definitional") && assessment.labelDetail
      ? `${LABEL_HEAD[assessment.label]} — ${assessment.labelDetail}`
      : LABEL_HEAD[assessment.label];

  return (
    <section
      aria-label="Top-line assessment"
      className="border border-stone-400 bg-stone-50"
    >
      {/* Top accent rule — the assessment is now the strongest visual element. */}
      <div className="h-[3px] bg-accent" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 bg-white px-5 py-2">
        <span className="pf-label-loud">Assessment</span>
        <ConfidenceDial level={assessment.confidence} />
      </div>
      <div className="space-y-4 p-5">
        <p className="font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
          {headline}
        </p>
        <p className="font-serif text-base leading-relaxed text-stone-800">
          {assessment.synthesis}
        </p>
        <p className="border-t border-stone-300 pt-3 font-serif text-xs italic leading-relaxed text-stone-600">
          This is a calibrated call from the available sources &mdash; not a final verdict.
          You can weigh the evidence yourself in the full dossier.
        </p>
      </div>
    </section>
  );
}

function ConfidenceDial({ level }: { level: AssessmentConfidence }) {
  const filled = CONFIDENCE_FILLED[level];
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={CONFIDENCE_LABEL[level]}
      title={CONFIDENCE_LABEL[level]}
    >
      <span className="font-mono text-[0.65rem] uppercase tracking-widish text-stone-600">
        Confidence
      </span>
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`inline-block h-2 w-2 rounded-full border border-ink ${
              n <= filled ? "bg-ink" : "bg-transparent"
            }`}
          />
        ))}
      </span>
      <span className="font-mono text-[0.65rem] uppercase tracking-widish text-ink">
        {level}
      </span>
    </div>
  );
}
