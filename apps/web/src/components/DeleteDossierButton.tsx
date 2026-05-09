import { useState } from "react";
import { deleteDossier } from "../lib/api.js";
import { APP_HASH, navigate } from "../lib/route.js";

interface Props {
  dossierId: string;
}

// Two-step delete: trigger button reveals a modal that requires explicit
// confirmation before calling the API. On success we route back to the app
// (the dossier no longer exists, so the permalink would 404). On error we
// keep the modal open and surface the message inline.
export function DeleteDossierButton({ dossierId }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "deleting" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setPhase("idle");
    setErrorMsg(null);
  }

  async function handleConfirm() {
    setPhase("deleting");
    setErrorMsg(null);
    try {
      await deleteDossier(dossierId);
      navigate(APP_HASH);
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-oxblood hover:bg-stone-100 hover:text-oxblood"
      >
        Delete
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Delete dossier"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={close}
        >
          <div
            className="max-w-md border border-oxblood bg-stone-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
              <span className="font-display text-xs font-bold uppercase tracking-widest text-oxblood">
                Delete this dossier?
              </span>
            </div>
            <div className="space-y-3 p-5">
              <p className="font-serif text-sm leading-relaxed text-stone-800">
                This will permanently remove the dossier from the database. There is
                no undo.
              </p>
              <p className="font-serif text-sm italic leading-relaxed text-stone-700">
                The link will stop working. Anyone you've shared it with will see "Dossier not found."
              </p>

              {phase === "error" && errorMsg && (
                <p className="border-l-2 border-oxblood bg-stone-100 px-3 py-2 font-serif text-sm text-stone-900">
                  <span className="font-display font-bold uppercase tracking-widish text-oxblood">
                    Error
                  </span>{" "}
                  — {errorMsg}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  disabled={phase === "deleting"}
                  className="border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={phase === "deleting"}
                  className="border border-oxblood bg-oxblood px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
                >
                  {phase === "deleting" ? "Deleting…" : "Delete forever"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
