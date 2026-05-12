import { useState } from "react";
import { setDossierShared } from "../lib/api.js";
import { buildDossierHash } from "../lib/route.js";

interface Props {
  dossierId: string;
  // Initial sharing state from the parent dossier. The creator-only PATCH
  // endpoint authorizes the change; the parent receives canDelete + isShared
  // from GET /api/dossier/:id, and only renders this control when the
  // requester is the creator (i.e., canDelete is true).
  isShared: boolean;
  // Notify the parent that the dossier's isShared changed so it can update
  // its own copy without a re-fetch.
  onSharedChange?: (isShared: boolean) => void;
}

const PUBLIC_BASE_URL = (import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined)?.replace(/\/$/, "");
const isLocalhostOrigin = (origin: string): boolean =>
  /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(origin);

export function ShareButton({ dossierId, isShared, onSharedChange }: Props) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(isShared);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const baseUrl = PUBLIC_BASE_URL ?? window.location.origin;
  const shareUrl = `${baseUrl}/${buildDossierHash(dossierId)}`;
  const linkIsLocalOnly = !PUBLIC_BASE_URL && isLocalhostOrigin(window.location.origin);

  async function toggle() {
    const next = !shared;
    setBusy(true);
    setError(null);
    try {
      const newState = await setDossierShared(dossierId, next);
      setShared(newState);
      onSharedChange?.(newState);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
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
    setCopied(false);
    setError(null);
  }

  // Trigger-button label reflects current state at a glance — public dossiers
  // get a visible accent so the creator can tell what's exposed.
  const triggerLabel = shared ? "Public ✓" : "Share";
  const triggerClass = shared
    ? "border border-accent bg-stone-50 px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-accent hover:bg-stone-100"
    : "border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink hover:bg-stone-100 hover:text-ink";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClass}>
        {triggerLabel}
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
              <span className="pf-label-loud">Share assessment</span>
            </div>
            <div className="space-y-4 p-5">
              <p className="font-serif text-sm leading-relaxed text-stone-800">
                Assessments are private by default — only you can see them at
                the URL below. Toggle public to add this one to the public
                archive so anyone with the link can read it.
              </p>

              <div className="flex items-start justify-between gap-4 border border-stone-300 bg-white p-3">
                <div className="min-w-0">
                  <p className="pf-label">Visibility</p>
                  <p className="mt-1 font-serif text-sm text-stone-800">
                    {shared
                      ? "Public — anyone with the link can read this."
                      : "Private — only you can read this."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggle}
                  disabled={busy}
                  aria-pressed={shared}
                  className={
                    shared
                      ? "shrink-0 border border-accent bg-accent px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-50 hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-60"
                      : "shrink-0 border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink disabled:cursor-not-allowed disabled:opacity-60"
                  }
                >
                  {busy ? "…" : shared ? "Make private" : "Make public"}
                </button>
              </div>

              {error && (
                <p className="border-l-2 border-oxblood bg-stone-100 px-3 py-2 font-mono text-xs text-oxblood">
                  {error}
                </p>
              )}

              {linkIsLocalOnly && (
                <div className="border border-accent-dim bg-stone-100 p-3">
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

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={copyLink}
                  disabled={!shared}
                  title={shared ? "" : "Make this assessment public before sharing the link."}
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
