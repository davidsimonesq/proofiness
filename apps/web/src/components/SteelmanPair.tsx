import { useState } from "react";
import type { Source, Steelman, SteelmanSide } from "@proofiness/shared-types";

interface Props {
  steelman: Steelman;
  sources: Source[];
  // Used only to deterministically pick the side ordering (audit #15).
  // Identical visual treatment isn't enough — reading order encodes weight.
  // Hashing the sub-claim id mod 2 means: stable on refresh, but varies across
  // sub-claims so there's no consistent for-first-or-against-first bias.
  subClaimId: string;
}

function hashMod2(s: string): 0 | 1 {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h & 1) as 0 | 1;
}

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
    <div className="mt-4 border border-stone-300 bg-stone-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between border-b border-stone-300 bg-stone-100 px-4 py-2 text-left hover:bg-stone-200"
        aria-expanded={expanded}
      >
        <span className="pf-label-loud">Steelman pair</span>
        <span className="font-mono text-xs text-stone-500" aria-hidden="true">
          {expanded ? "[ − ]" : "[ + ]"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 p-4">
          {forFirst ? forBlock : againstBlock}
          <div className="pf-hairline" />
          {forFirst ? againstBlock : forBlock}
          <p className="border-t border-stone-300 pt-3 font-serif text-xs italic leading-relaxed text-stone-600">
            Both cases constructed from the sources above. Order is deterministic per sub-claim
            — don't read it as ranking. The strongest possible case for either side may exist
            outside this dossier. <span className="not-italic font-mono">You weigh them.</span>
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
      <h4 className="pf-label mb-2">{label}</h4>
      <p className="font-serif text-sm leading-relaxed text-ink">
        {renderArgumentWithCitations(side.argument, sourceById)}
      </p>
      {side.sourceIds.length > 0 && (
        <ul className="mt-3 space-y-1 border-l-2 border-stone-300 pl-3">
          {side.sourceIds.map((id) => {
            const s = sourceById.get(id);
            if (!s) return null;
            return (
              <li key={id} className="font-mono text-xs">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-stone-700 underline decoration-stone-400 underline-offset-2 hover:text-ink hover:decoration-ink"
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
      parts.push(m[0]);
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
        className="font-mono text-xs text-stone-700 underline decoration-stone-400 underline-offset-2 hover:text-ink hover:decoration-ink"
      >
        [{p.id}]
      </a>
    );
  });
}
