import type { Contestation } from "@crux/shared-types";

// Per-sub-claim badge showing where the disagreement (if any) sits.
// Visually neutral: NO green-equals-good, NO red-equals-bad. The user evaluates.
// All badges share the same visual frame; only the label text differs.
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
  note?: string;
}

export function ContestationBadge({ label, note }: Props) {
  return (
    <span
      title={note}
      className="inline-flex items-center rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
    >
      {LABELS[label]}
    </span>
  );
}
