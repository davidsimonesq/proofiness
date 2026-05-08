import { useState } from "react";
import { buildDossierHash } from "../lib/route.js";

interface Props {
  dossierId: string;
}

// If VITE_PUBLIC_BASE_URL is set at build time (e.g. https://crux.example.com),
// share links use that origin. Otherwise we fall back to window.location.origin
// (i.e. the URL the current user is browsing). For a local dev instance that
// resolves to http://localhost:5173, which won't work for any recipient.
const PUBLIC_BASE_URL = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(/\/$/, "");
const isLocalhostOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);

// Per spec §4: friction before sharing — require an explicit acknowledgment
// before the link can be copied. Goal is to discourage screenshot-as-verdict
// distribution. The user has to actively confirm they read the dossier.
export function ShareButton({ dossierId }: Props) {
  const [open, setOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copied, setCopied] = useState(false);

  const baseUrl = PUBLIC_BASE_URL ?? window.location.origin;
  const shareUrl = `${baseUrl}/${buildDossierHash(dossierId)}`;
  const linkIsLocalOnly = !PUBLIC_BASE_URL && isLocalhostOrigin(window.location.origin);

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

            {linkIsLocalOnly && (
              <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                <strong>Heads up:</strong> the link points at <code className="font-mono">{window.location.origin}</code> —
                that's your local dev server. The recipient won't be able to open it. Set{" "}
                <code className="font-mono">VITE_PUBLIC_BASE_URL</code> in <code className="font-mono">apps/web/.env</code>{" "}
                (and rebuild) once you have a deployed instance.
              </div>
            )}

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
