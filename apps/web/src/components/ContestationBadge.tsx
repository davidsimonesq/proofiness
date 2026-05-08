import type { Contestation } from "@crux/shared-types";

// Per-sub-claim badge showing where the disagreement (if any) sits.
// Visually neutral: NO green-equals-good, NO red-equals-bad. The user evaluates.
// All badges share the same visual frame; only the label text differs.
//
// The structural note (e.g. "Peer-reviewed studies disagree on the magnitude")
// is rendered as italic prose below the header in SubClaimCard — it is NOT
// duplicated as a `title` attribute here. Title attributes are hover-only on
// desktop and completely invisible on mobile, so a critical-context piece can't
// rely on them.
const LABELS: Record<Contestation, string> = {
  empirically_settled: "Empirically settled",
  contested_with_evidence: "Contested with evidence",
  contested_by_faction: "Contested by faction",
  definitional_dispute: "Definitional dispute",
  value_laden: "Value-laden",
  unresolvable_unknown: "Unresolvable / unknown",
};

interface Props {
  label: Contestation;
}

export function ContestationBadge({ label }: Props) {
  return (
    <span className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700">
      {LABELS[label]}
    </span>
  );
}
