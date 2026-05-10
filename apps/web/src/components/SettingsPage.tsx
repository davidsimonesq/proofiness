import { useState, type FormEvent } from "react";
import {
  clearUserKeys,
  getUserKeys,
  hasFullByokKeys,
  maskKey,
  setUserKeys,
} from "../lib/keys.js";
import { getInviteCode } from "../lib/invites.js";
import { SectionHeader } from "../App.js";

// Settings page — currently just BYOK key management. The keys live in
// localStorage and are sent as request headers when both are set; the server
// uses them per-request and does not store them. The Privacy policy spells
// this out in detail.

export function SettingsPage() {
  const stored = getUserKeys();
  const [anthropic, setAnthropic] = useState("");
  const [tavily, setTavily] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Re-render when keys change so the "current state" panel reflects them.
  const [version, setVersion] = useState(0);
  const [copied, setCopied] = useState(false);

  const hasBoth = hasFullByokKeys();
  const current = getUserKeys();
  const inviteCode = getInviteCode();

  async function handleCopyInvite() {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore — copy not supported */
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const a = anthropic.trim();
    const t = tavily.trim();
    if (!a || !t) return;
    setUserKeys(a, t);
    setAnthropic("");
    setTavily("");
    setSavedAt(new Date().toLocaleTimeString());
    setVersion((v) => v + 1);
  }

  function handleClear() {
    clearUserKeys();
    setAnthropic("");
    setTavily("");
    setSavedAt(null);
    setVersion((v) => v + 1);
  }

  return (
    <article className="space-y-8" key={version}>
      <a
        href="#/"
        className="inline-block font-mono text-xs uppercase tracking-widish text-stone-600 hover:text-ink"
      >
        ← Home
      </a>

      <SectionHeader number="S" label="Settings" />

      {/* Invite code — shown first so users on a different browser can copy
          and reuse their existing code without having to mint a new one. */}
      <div className="border border-stone-400 bg-stone-50">
        <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
          <span className="pf-label-loud">Your invite code</span>
        </div>
        <div className="space-y-3 p-5">
          {inviteCode ? (
            <>
              <p className="font-serif text-sm leading-relaxed text-stone-700">
                Copy the Invite Code if you want to use Proofiness on another
                device. There's no way for us to give it to you again.
              </p>
              <dl className="grid gap-x-6 gap-y-1 font-mono text-sm text-stone-700 sm:grid-cols-[max-content_1fr]">
                <dt className="text-stone-500">Code</dt>
                <dd className="select-all font-bold text-ink">{inviteCode}</dd>
              </dl>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-ink hover:text-ink"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </>
          ) : (
            <p className="font-serif text-sm leading-relaxed text-stone-700">
              No invite code saved in this browser.{" "}
              <a
                href="#/request-invite"
                className="font-mono text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
              >
                Request one →
              </a>
            </p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border border-stone-400 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-stone-300 bg-stone-100 px-4 py-2">
          <span className="pf-label-loud">API Keys</span>
          {hasBoth && (
            <span className="font-display text-xs font-bold uppercase tracking-widish text-accent">
              BYOK active
            </span>
          )}
        </div>
        <div className="space-y-4 p-5">
          <p className="font-serif text-base leading-relaxed text-stone-800">
            Proofiness allows you to assess a limited number of claims free of charge. To
            continue beyond that number, provide your own API keys for Anthropic (Claude AI)
            and Tavily (a web-search service). Both keys are stored only in this browser,
            sent per-request, and never written to the server &mdash; see{" "}
            <a
              href="#/privacy"
              className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
            >
              Privacy
            </a>{" "}
            §5 for details.
          </p>

          <label className="block">
            <span className="pf-label">Anthropic API Key</span>
            {current.anthropic && (
              <span className="ml-2 font-mono text-[0.7rem] uppercase tracking-widish text-accent">
                currently set &middot; {maskKey(current.anthropic)}
              </span>
            )}
            <input
              type="password"
              value={anthropic}
              onChange={(e) => setAnthropic(e.target.value)}
              placeholder={current.anthropic ? "Enter a new key to replace" : "sk-ant-..."}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 block w-full border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-sm tracking-wide text-ink placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none"
            />
            <span className="mt-1 block font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
              Get one at console.anthropic.com
            </span>
          </label>

          <label className="block">
            <span className="pf-label">Tavily API Key</span>
            {current.tavily && (
              <span className="ml-2 font-mono text-[0.7rem] uppercase tracking-widish text-accent">
                currently set &middot; {maskKey(current.tavily)}
              </span>
            )}
            <input
              type="password"
              value={tavily}
              onChange={(e) => setTavily(e.target.value)}
              placeholder={current.tavily ? "Enter a new key to replace" : "tvly-..."}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 block w-full border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-sm tracking-wide text-ink placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none"
            />
            <span className="mt-1 block font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
              Get one at tavily.com
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-3">
              {hasBoth && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-oxblood hover:text-oxblood"
                >
                  Clear keys
                </button>
              )}
              {savedAt && (
                <span className="font-mono text-[0.7rem] uppercase tracking-widish text-accent">
                  Saved at {savedAt}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!anthropic.trim() || !tavily.trim()}
              className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
            >
              Save keys
            </button>
          </div>

          <p className="border-t border-stone-200 pt-3 font-serif text-xs italic leading-relaxed text-stone-600">
            Cost reference: a typical assessment uses roughly $0.20–0.30 of Anthropic credit
            and ~20 Tavily searches (up to 1,000/month free). You can monitor your
            usage and cost directly at console.anthropic.com and tavily.com.
          </p>
        </div>
      </form>
    </article>
  );
}
