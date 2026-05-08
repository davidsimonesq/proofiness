import type { ClassifierUsed, SourceType } from "@proofiness/shared-types";

// Visual treatment is deliberately neutral — no green-equals-good color encoding.
// The badge tells the user WHAT KIND of source it is, not whether to trust it.
const LABELS: Record<SourceType, string> = {
  unknown: "Unclassified",
  primary_research: "Primary research",
  peer_reviewed: "Peer-reviewed",
  secondary_reporting: "Reporting",
  opinion: "Opinion",
  government: "Government",
  institutional: "Institutional",
  advocacy: "Advocacy",
  social_media: "Social",
  aggregator: "Aggregator",
};

const CLASSIFIER_HINT: Record<ClassifierUsed, string> = {
  rule: "Classified by domain rule.",
  llm: "Classified by AI — verify by clicking through.",
  fallback: "Classifier didn't fire — open the source to judge for yourself.",
};

interface Props {
  sourceType: SourceType;
  classifierUsed?: ClassifierUsed;
}

export function SourceQualityBadge({ sourceType, classifierUsed }: Props) {
  const title = classifierUsed ? CLASSIFIER_HINT[classifierUsed] : undefined;
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center gap-1 border border-stone-400 bg-stone-50 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-widish text-stone-700"
    >
      <span>{LABELS[sourceType]}</span>
      {classifierUsed === "llm" && (
        <span aria-hidden="true" className="text-stone-400">
          ·AI
        </span>
      )}
      {classifierUsed === "fallback" && (
        <span aria-hidden="true" className="text-stone-400">
          ·?
        </span>
      )}
    </span>
  );
}
