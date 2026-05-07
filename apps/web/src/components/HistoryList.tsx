import { useEffect, useState } from "react";
import type { DossierSummary } from "@crux/shared-types";
import { listDossiers } from "../lib/api.js";
import { buildDossierHash } from "../lib/route.js";

export function HistoryList() {
  const [items, setItems] = useState<DossierSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listDossiers()
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return <p className="text-sm text-rose-700">Couldn't load history: {error}</p>;
  }
  if (!items) {
    return <p className="text-sm text-slate-500">Loading history…</p>;
  }
  if (items.length === 0) {
    return (
      <p className="text-sm italic text-slate-500">
        No saved dossiers yet. Submit a claim above to start.
      </p>
    );
  }

  return (
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
  );
}
