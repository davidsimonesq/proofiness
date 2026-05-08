import { useState } from "react";
import type { Source, Steelman, SteelmanSide } from "@crux/shared-types";

interface Props {
  steelman: Steelman;
  sources: Source[];
  // Used only to deterministically pick the side ordering (audit #15).
  // Identical visual treatment isn't enough — reading order encodes weight.
  // Hashing the sub-claim id mod 2 means: stable on refresh, but varies across
  // sub-claims so there's no consistent for-first-or-against-first bias across
  // the dossier.
  subClaimId: string;
}

// Tiny string hash. Not cryptographic; just needs to be deterministic and
// reasonably distributed across the (1 bit) output space.
function hashMod2(s: string): 0 | 1 {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h & 1) as 0 | 1;
}

// Renders a steelman as two stacked sections with IDENTICAL visual treatment.
// No green/red, no "stronger side" indicator — both sides get the same neutral
// frame. Per spec §4 (progressive disclosure), the pair is collapsed by default.
export function SteelmanPair({ steelman, sources, subClaimId }: Props) {
  const [expanded, setExpanded] = useState(false);

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const forFirst = hashMod2(subClaimId) === 0;

  const forBlock = (
    <SteelmanSideBlock label="Case for" side={steelman.for} sourceById={sourceById} />
  );
  const againstBlock = (
    <SteelmanSideBlock label="Case against" side={steelman.against} sourceById={sourceById} />
  );

  return (
    <div className="mt-3 rounded border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between rounded px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
        aria-expanded={expanded}
      >
        <span>Steelman pair</span>
        <span className="text-slate-400" aria-hidden="true">
          {expanded ? "−" : "+"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3">
          {forFirst ? forBlock : againstBlock}
          {forFirst ? againstBlock : forBlock}
          <p className="pt-1 text-xs italic text-slate-500">
            Both cases are constructed from the sources above. The strongest possible case for
            either side may exist outside this dossier. Order is deterministic per sub-claim;
            don't read it as ranking. You weigh them.
          </p>
        </div>
      )}
    </div>
  );
}

interface SideProps {
  label: string;
  side: SteelmanSide;
  sourceById: Map<string, Source>;
}

function SteelmanSideBlock({ label, side, sourceById }: SideProps) {
  return (
    <section>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </h4>
      <p className="text-sm text-slate-800">{renderArgumentWithCitations(side.argument, sourceById)}</p>
      {side.sourceIds.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
          {side.sourceIds.map((id) => {
            const s = sourceById.get(id);
            if (!s) return null;
            return (
              <li key={id}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700"
                >
                  {s.title}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Replace inline [s1] markers with clickable links to the matching source.
// Falls back to the bracketed token if the id isn't in the source map.
function renderArgumentWithCitations(text: string, sourceById: Map<string, Source>) {
  const parts: Array<string | { id: string; title: string; url: string }> = [];
  const re = /\[([a-z0-9-]+)\]/gi;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const id = m[1]!;
    const src = sourceById.get(id);
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
    if (src) {
      parts.push({ id, title: src.title, url: src.url });
    } else {
      parts.push(m[0]); // Leave the literal [s7] if id is unknown
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));

  return parts.map((p, i) => {
    if (typeof p === "string") return <span key={i}>{p}</span>;
    return (
      <a
        key={i}
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        title={p.title}
        className="text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700"
      >
        [{p.id}]
      </a>
    );
  });
}
