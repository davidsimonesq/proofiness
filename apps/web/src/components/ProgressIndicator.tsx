import type { ProgressEvent, ProgressStep } from "@crux/shared-types";

// Order matches the pipeline. Steps not yet reached render dim; the in-flight
// step is highlighted; completed steps render as a checkmark color.
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
  "persisting",
];

const STEP_LABELS: Record<ProgressStep, string> = {
  normalizing: "Normalize",
  decomposing: "Decompose",
  searching: "Search",
  fetching: "Fetch sources",
  classifying_sources: "Classify",
  tracing_provenance: "Trace provenance",
  generating_steelmans: "Steelman",
  classifying_contestation: "Contestation",
  identifying_crux: "Identify crux",
  persisting: "Save",
};

interface Props {
  current: ProgressEvent | null;
}

export function ProgressIndicator({ current }: Props) {
  const currentIdx = current ? STEP_ORDER.indexOf(current.step) : -1;

  return (
    <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-sm text-slate-700">
        {current ? current.message : "Starting…"}
        {current?.sublabel && (
          <span className="ml-1 text-slate-500">— {current.sublabel}</span>
        )}
      </p>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {STEP_ORDER.map((step, idx) => {
          const status =
            idx < currentIdx
              ? "done"
              : idx === currentIdx
                ? "active"
                : "pending";
          const dotClass =
            status === "done"
              ? "bg-slate-700"
              : status === "active"
                ? "bg-slate-900 animate-pulse"
                : "bg-slate-300";
          const labelClass =
            status === "done"
              ? "text-slate-600"
              : status === "active"
                ? "font-semibold text-slate-900"
                : "text-slate-400";
          return (
            <li key={step} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
              <span className={labelClass}>{STEP_LABELS[step]}</span>
              {idx < STEP_ORDER.length - 1 && (
                <span className="text-slate-300" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs italic text-slate-500">
        Cold dossiers take 60–140 seconds — the pipeline is making real searches and LLM calls.
      </p>
    </div>
  );
}
