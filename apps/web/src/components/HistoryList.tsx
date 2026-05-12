import { useEffect, useState } from "react";
import type { DossierSummary } from "@proofiness/shared-types";
import { deleteDossier, listDossiers } from "../lib/api.js";
import { getInviteCode } from "../lib/invites.js";
import { buildDossierHash } from "../lib/route.js";

type Scope = "mine" | "public";

export function HistoryList() {
  // "Mine" requires an invite code in localStorage; default to it when present
  // so returning users see their own work first. New visitors land on "Public".
  const [scope, setScope] = useState<Scope>(() => (getInviteCode() ? "mine" : "public"));
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
    setItems([]);
    setNextCursor(null);
    setConfirmId(null);
    setRowError(null);
    listDossiers({ scope })
      .then((page) => {
        setItems(page.dossiers);
        setNextCursor(page.nextCursor);
        setPhase("ready");
      })
      .catch((err: Error) => {
        setError(err.message);
        setPhase("error");
      });
  }, [scope]);

  async function loadMore() {
    if (!nextCursor) return;
    setPhase("loading_more");
    try {
      const page = await listDossiers({ cursor: nextCursor, scope });
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

  const tabs = (
    <div className="mb-3 flex gap-0 border border-stone-300 bg-stone-100">
      <TabButton
        active={scope === "mine"}
        onClick={() => setScope("mine")}
        label="Yours"
      />
      <TabButton
        active={scope === "public"}
        onClick={() => setScope("public")}
        label="Public"
      />
    </div>
  );

  if (phase === "loading") {
    return (
      <>
        {tabs}
        <p className="font-mono text-sm text-stone-600">Loading index…</p>
      </>
    );
  }
  if (phase === "error") {
    return (
      <>
        {tabs}
        <p className="font-mono text-sm text-oxblood">Couldn't load index: {error}</p>
      </>
    );
  }
  if (items.length === 0) {
    return (
      <>
        {tabs}
        <p className="font-serif text-sm italic text-stone-600">
          {scope === "mine"
            ? "You haven't created any assessments yet — or you're using a different invite code than the one that created them."
            : "No assessments have been shared to the public archive yet."}
        </p>
      </>
    );
  }

  return (
    <>
      {tabs}
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
                    {scope === "mine" && item.isShared && (
                      <span className="ml-2 text-accent">• Public</span>
                    )}
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
                        aria-label={`Delete assessment ${item.number}`}
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

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "flex-1 border-b-2 border-accent bg-white px-3 py-2 font-display text-xs font-semibold uppercase tracking-widish text-ink"
          : "flex-1 border-b-2 border-transparent px-3 py-2 font-display text-xs font-semibold uppercase tracking-widish text-stone-500 hover:bg-stone-50 hover:text-ink"
      }
    >
      {label}
    </button>
  );
}
