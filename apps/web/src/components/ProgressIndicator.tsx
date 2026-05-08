import type { ProgressEvent, ProgressStep } from "@proofiness/shared-types";

const STEP_ORDER: ProgressStep[] = [
  "normalizing",
  "decomposing",
  "searching",
  "fetching",
  "classifying_sources",
  "tracing_provenance",
  "generating_steelmans",
  "classifying_contestation",
  "identifying_crux",
  "assessing",
  "persisting",
];

const STEP_LABELS: Record<ProgressStep, string> = {
  normalizing: "Normalize claim",
  decomposing: "Decompose into sub-claims",
  searching: "Multi-framing search",
  fetching: "Fetch + extract",
  classifying_sources: "Classify sources",
  tracing_provenance: "Trace provenance",
  generating_steelmans: "Steelman pairs",
  classifying_contestation: "Contestation labels",
  identifying_crux: "Identify crux",
  assessing: "Top-line assessment",
  persisting: "Persist dossier",
};

interface Props {
  current: ProgressEvent | null;
}

export function ProgressIndicator({ current }: Props) {
  const currentIdx = current ? STEP_ORDER.indexOf(current.step) : -1;

  return (
    <div className="border border-stone-400 bg-white">
      <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
        <span className="pf-label-loud">Pipeline · in progress</span>
      </div>
      <div className="p-4">
        <p className="mb-4 font-serif text-sm leading-relaxed text-stone-800">
          {current ? current.message : "Starting…"}
          {current?.sublabel && (
            <span className="text-stone-500"> — {current.sublabel}</span>
          )}
        </p>

        <ol className="space-y-1">
          {STEP_ORDER.map((step, idx) => {
            const status =
              idx < currentIdx
                ? "done"
                : idx === currentIdx
                  ? "active"
                  : "pending";
            return (
              <li
                key={step}
                className={`flex items-center gap-3 border-l-2 py-1 pl-3 ${
                  status === "active"
                    ? "border-ink bg-stone-100"
                    : status === "done"
                      ? "border-stone-500"
                      : "border-stone-300"
                }`}
              >
                <span
                  className={`font-mono text-[0.7rem] uppercase tracking-widish ${
                    status === "active"
                      ? "text-ink"
                      : status === "done"
                        ? "text-stone-600"
                        : "text-stone-400"
                  }`}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span
                  className={`font-display text-xs font-semibold uppercase tracking-widish ${
                    status === "active"
                      ? "text-ink"
                      : status === "done"
                        ? "text-stone-700"
                        : "text-stone-400"
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
                <span
                  className={`ml-auto font-mono text-[0.65rem] uppercase tracking-widish ${
                    status === "active"
                      ? "text-ink"
                      : status === "done"
                        ? "text-stone-500"
                        : "text-stone-300"
                  }`}
                  aria-hidden="true"
                >
                  {status === "active" ? "▶" : status === "done" ? "✓" : "·"}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 border-t border-stone-300 pt-3 font-serif text-xs italic leading-relaxed text-stone-600">
          Cold dossiers take 60–180 seconds. The pipeline is making real searches and LLM calls.
        </p>
      </div>
    </div>
  );
}
