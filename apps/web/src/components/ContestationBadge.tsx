import type { Contestation } from "@proofiness/shared-types";

// Per-sub-claim badge — tight monospace caps, square hairline border. NO
// green/red. The structural note ("Peer-reviewed studies disagree on the
// magnitude") is rendered as italic prose below the header in SubClaimCard.
const LABELS: Record<Contestation, string> = {
  empirically_settled: "Settled",
  contested_with_evidence: "Contested · evidence",
  contested_by_faction: "Contested · faction",
  definitional_dispute: "Definitional",
  value_laden: "Value-laden",
  unresolvable_unknown: "Unknown",
};

interface Props {
  label: Contestation;
}

export function ContestationBadge({ label }: Props) {
  return (
    <span className="inline-flex items-center border border-stone-400 bg-white px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-widish text-stone-700">
      {LABELS[label]}
    </span>
  );
}
