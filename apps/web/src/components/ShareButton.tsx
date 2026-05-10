import { useState } from "react";
import { buildDossierHash } from "../lib/route.js";

interface Props {
  dossierId: string;
}

const PUBLIC_BASE_URL = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(/\/$/, "");
const isLocalhostOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);

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
        className="border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink hover:bg-stone-100 hover:text-ink"
      >
        Share →
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share assessment"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4"
          onClick={close}
        >
          <div
            className="max-w-md border border-stone-400 bg-stone-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
              <span className="pf-label-loud">Share assessment — acknowledgment required</span>
            </div>
            <div className="p-5">
              <p className="font-serif text-sm leading-relaxed text-stone-800">
                You'll be sharing a link to the calibrated assessment <em>and</em> the full
                dossier behind it — every sub-claim, every source, every steelman.{" "}
                <span className="italic">Not a screenshot. Not a final verdict.</span>
              </p>
              <p className="mt-3 font-serif text-sm leading-relaxed text-stone-800">
                The assessment is a calibrated call from the available sources, not a final
                pronouncement. The dossier exists so the recipient can check the receipts —
                see what the assessment is grounded in, and push back when it isn't earned.
              </p>

              {linkIsLocalOnly && (
                <div className="mt-4 border border-accent-dim bg-stone-100 p-3">
                  <p className="pf-label" style={{ color: "#92400e" }}>
                    Heads up — local-only link
                  </p>
                  <p className="mt-1 font-mono text-xs text-stone-700">
                    {window.location.origin} won't be reachable for the recipient. Set{" "}
                    <span className="text-ink">VITE_PUBLIC_BASE_URL</span> in{" "}
                    <span className="text-ink">apps/web/.env</span> when you have a deployed instance.
                  </p>
                </div>
              )}

              <label className="mt-5 flex items-start gap-3 border border-stone-300 bg-white p-3 text-sm text-stone-900">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-ink"
                />
                <span className="font-serif leading-relaxed">
                  I've read this assessment and at least skimmed the dossier behind it. I'm
                  sharing it as a starting point for inquiry, not as proof of a position.
                </span>
              </label>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!acknowledged}
                  className="border border-ink bg-ink px-4 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
                >
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
