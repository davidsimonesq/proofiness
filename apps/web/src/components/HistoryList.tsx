import { useEffect, useState } from "react";
import type { DossierSummary } from "@crux/shared-types";
import { listDossiers } from "../lib/api.js";
import { buildDossierHash } from "../lib/route.js";

export function HistoryList() {
  const [items, setItems] = useState<DossierSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "loading_more" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhase("loading");
    listDossiers()
      .then((page) => {
        setItems(page.dossiers);
        setNextCursor(page.nextCursor);
        setPhase("ready");
      })
      .catch((err: Error) => {
        setError(err.message);
        setPhase("error");
      });
  }, []);

  async function loadMore() {
    if (!nextCursor) return;
    setPhase("loading_more");
    try {
      const page = await listDossiers({ cursor: nextCursor });
      setItems((prev) => [...prev, ...page.dossiers]);
      setNextCursor(page.nextCursor);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  if (phase === "loading") {
    return <p className="text-sm text-slate-500">Loading history…</p>;
  }
  if (phase === "error") {
    return <p className="text-sm text-rose-700">Couldn't load history: {error}</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm italic text-slate-500">
        No saved dossiers yet. Submit a claim above to start.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={buildDossierHash(item.id)}
              className="block rounded border border-slate-200 bg-white p-3 shadow-sm hover:bg-slate-50"
            >
              <p className="line-clamp-2 text-sm text-slate-900">{item.claim}</p>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </a>
          </li>
        ))}
      </ul>
      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={phase === "loading_more"}
          className="mt-3 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {phase === "loading_more" ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
