import type { ClassifierUsed, SourceType } from "@crux/shared-types";

// Visual treatment is deliberately neutral — no green-equals-good color encoding.
// Quality of evidence is the user's call. The badge tells them WHAT KIND of
// source it is, not whether to trust it.

const LABELS: Record<SourceType, string> = {
  unknown: "Unclassified",
  primary_research: "Primary research",
  peer_reviewed: "Peer-reviewed",
  secondary_reporting: "Secondary reporting",
  opinion: "Opinion / editorial",
  government: "Government / official",
  institutional: "Institutional",
  advocacy: "Advocacy",
  social_media: "Social media",
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
      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
    >
      <span>{LABELS[sourceType]}</span>
      {classifierUsed === "llm" && (
        <span aria-hidden="true" className="text-slate-400">
          ·AI
        </span>
      )}
      {classifierUsed === "fallback" && (
        <span aria-hidden="true" className="text-slate-400">
          ·?
        </span>
      )}
    </span>
  );
}
