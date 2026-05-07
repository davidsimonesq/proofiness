import type { Dossier } from "@crux/shared-types";
import { SubClaimCard } from "./SubClaimCard.js";
import { LimitsDisclosure } from "./LimitsDisclosure.js";
import { CruxSummary } from "./CruxSummary.js";
import { ShareButton } from "./ShareButton.js";

interface Props {
  dossier: Dossier;
}

export function DossierView({ dossier }: Props) {
  const cruxSet = new Set(dossier.crux?.hingesOn ?? []);

  return (
    <section className="space-y-6">
      <header className="rounded border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wide text-slate-500">Original claim</p>
            <p className="mt-1 text-base text-slate-900">{dossier.claim}</p>
          </div>
          <ShareButton dossierId={dossier.id} />
        </div>
        {dossier.context && (
          <>
            <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Context</p>
            <p className="mt-1 text-sm text-slate-700">{dossier.context}</p>
          </>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Generated {new Date(dossier.createdAt).toLocaleString()}
        </p>
      </header>

      {dossier.crux && <CruxSummary crux={dossier.crux} subClaims={dossier.subClaims} />}

      <LimitsDisclosure />

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">
          Decomposition ({dossier.subClaims.length} sub-claim
          {dossier.subClaims.length === 1 ? "" : "s"})
        </h2>
        <div className="space-y-4">
          {dossier.subClaims.map((sc) => (
            <SubClaimCard key={sc.id} subClaim={sc} isCrux={cruxSet.has(sc.id)} />
          ))}
        </div>
      </div>

      {dossier.embeddedAssumptions.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Embedded assumptions
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {dossier.embeddedAssumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {dossier.unresolvedQuestions.length > 0 && (
        <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
            Unresolved questions
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {dossier.unresolvedQuestions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
