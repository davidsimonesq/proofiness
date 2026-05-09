import { useEffect, useState } from "react";
import type { DossierSummary } from "@proofiness/shared-types";
import { deleteDossier, listDossiers } from "../lib/api.js";
import { buildDossierHash } from "../lib/route.js";

export function HistoryList() {
  const [items, setItems] = useState<DossierSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "loading_more" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  // Two-step delete: first click sets confirmId; second click on same row
  // commits. Clicking elsewhere or any other row clears confirmId.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; msg: string } | null>(null);

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

  async function handleDelete(id: string) {
    setDeletingId(id);
    setRowError(null);
    try {
      await deleteDossier(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setConfirmId(null);
    } catch (err) {
      setRowError({ id, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeletingId(null);
    }
  }

  if (phase === "loading") {
    return <p className="font-mono text-sm text-stone-600">Loading index…</p>;
  }
  if (phase === "error") {
    return (
      <p className="font-mono text-sm text-oxblood">
        Couldn't load index: {error}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p className="font-serif text-sm italic text-stone-600">
        No saved dossiers yet. Submit a claim above to start the index.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y divide-stone-300 border border-stone-300 bg-white">
        {items.map((item) => {
          const isConfirming = confirmId === item.id;
          const isDeleting = deletingId === item.id;
          const err = rowError?.id === item.id ? rowError.msg : null;
          return (
            <li key={item.id}>
              <div className="flex items-baseline gap-3 px-4 py-3 hover:bg-stone-50">
                <span className="shrink-0 font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                  {String(item.number).padStart(3, "0")}
                </span>
                <a href={buildDossierHash(item.id)} className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-sans text-sm text-ink">{item.claim}</p>
                  <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  {err && (
                    <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-widish text-oxblood">
                      {err}
                    </p>
                  )}
                </a>
                {item.canDelete && (
                  <div className="flex shrink-0 items-center gap-2">
                    {isConfirming ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          disabled={isDeleting}
                          className="border border-oxblood bg-oxblood px-2 py-1 font-display text-[0.65rem] font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          disabled={isDeleting}
                          className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500 hover:text-ink disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmId(item.id);
                          setRowError(null);
                        }}
                        className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-400 hover:text-oxblood"
                        aria-label={`Delete dossier ${item.number}`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
                <a
                  href={buildDossierHash(item.id)}
                  className="shrink-0 font-mono text-stone-400 hover:text-ink"
                  aria-hidden="true"
                >
                  →
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      {nextCursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={phase === "loading_more"}
          className="mt-3 w-full border border-stone-400 bg-stone-100 px-3 py-2 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink hover:bg-stone-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {phase === "loading_more" ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
