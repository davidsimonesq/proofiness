import { useState } from "react";
import { buildDossierHash } from "../lib/route.js";

interface Props {
  dossierId: string;
}

// Per spec §4: friction before sharing — require an explicit acknowledgment
// before the link can be copied. Goal is to discourage screenshot-as-verdict
// distribution. The user has to actively confirm they read the dossier.
export function ShareButton({ dossierId }: Props) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/${buildDossierHash(dossierId)}`;

  async function copyLink() {
    if (!acknowledged) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Older browsers / non-secure contexts: fall back to a prompt the user
      // can manually copy from. Not pretty but always works.
      window.prompt("Copy this link:", shareUrl);
    }
  }

  function close() {
    setOpen(false);
    setAcknowledged(false);
    setCopied(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Share
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share dossier"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={close}
        >
          <div
            className="max-w-md rounded border border-slate-300 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-slate-900">Share this dossier</h3>
            <p className="mt-2 text-sm text-slate-700">
              You'll be sharing a link to the structured dossier — every sub-claim, every source,
              every steelman. Not a screenshot. Not a verdict.
            </p>
            <p className="mt-2 text-sm text-slate-700">
              Crux dossiers don't conclude anything. The whole point is that the recipient reads
              the case file and judges for themselves.
            </p>

            <label className="mt-4 flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5"
              />
              <span>I've read this dossier and I'm sharing it as a starting point for inquiry, not as proof of a position.</span>
            </label>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={copyLink}
                disabled={!acknowledged}
                className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
