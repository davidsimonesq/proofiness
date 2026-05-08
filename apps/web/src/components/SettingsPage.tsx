import { useState, type FormEvent } from "react";
import {
  clearUserKeys,
  getUserKeys,
  hasFullByokKeys,
  maskKey,
  setUserKeys,
} from "../lib/keys.js";
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

  const hasBoth = hasFullByokKeys();
  const current = getUserKeys();

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
        ← Index
      </a>

      <SectionHeader number="S" label="Settings — Use Your Own API Keys" />

      <div className="space-y-4 border border-stone-300 bg-white p-6 sm:p-8">
        <p className="font-serif text-base leading-relaxed text-stone-800">
          By default, Proofiness uses the embedded API keys and gates access by invite code with
          a daily dossier cap. If you'd rather use your own Anthropic and Tavily keys —{" "}
          <strong>unlimited dossiers, billed directly to your accounts</strong> — set them here.
        </p>
        <p className="font-serif text-sm italic leading-relaxed text-stone-700">
          Your keys are stored only in this browser's localStorage. They are sent with each
          dossier request as headers, used by the server for that single request, and never
          stored on disk or in logs. Both keys must be set together. See{" "}
          <a
            href="#/privacy"
            className="text-ink underline decoration-stone-400 underline-offset-2 hover:decoration-ink"
          >
            Privacy
          </a>{" "}
          for details.
        </p>
      </div>

      {/* Current state */}
      <div className="border border-stone-400 bg-stone-50">
        <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
          <span className="pf-label-loud">Current state</span>
        </div>
        <div className="space-y-3 p-5">
          {hasBoth ? (
            <>
              <p className="font-serif text-base leading-relaxed text-ink">
                <span className="font-display font-bold uppercase tracking-widish text-accent">
                  BYOK active.
                </span>{" "}
                Dossier requests will use your keys; cost gate is bypassed.
              </p>
              <dl className="grid gap-x-6 gap-y-1 font-mono text-xs text-stone-700 sm:grid-cols-[max-content_1fr]">
                <dt className="text-stone-500">Anthropic key</dt>
                <dd className="text-ink">{current.anthropic ? maskKey(current.anthropic) : "—"}</dd>
                <dt className="mt-1 text-stone-500 sm:mt-0">Tavily key</dt>
                <dd className="text-ink">{current.tavily ? maskKey(current.tavily) : "—"}</dd>
              </dl>
              <button
                type="button"
                onClick={handleClear}
                className="mt-2 border border-stone-400 bg-white px-3 py-1.5 font-display text-xs font-semibold uppercase tracking-widish text-stone-700 hover:border-oxblood hover:text-oxblood"
              >
                Clear my keys
              </button>
            </>
          ) : (
            <p className="font-serif text-base leading-relaxed text-stone-700">
              <span className="font-display font-bold uppercase tracking-widish text-stone-700">
                Embedded mode.
              </span>{" "}
              Dossier requests use the server's built-in keys; cost gate (invite code +
              daily cap) applies. Set your own keys below to switch.
            </p>
          )}
        </div>
      </div>

      {/* Set keys form */}
      <form onSubmit={handleSubmit} className="border border-stone-400 bg-white">
        <div className="border-b border-stone-300 bg-stone-100 px-4 py-2">
          <span className="pf-label-loud">Set / replace your keys</span>
        </div>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="pf-label">Anthropic API Key</span>
            <input
              type="password"
              value={anthropic}
              onChange={(e) => setAnthropic(e.target.value)}
              placeholder="sk-ant-..."
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
            <input
              type="password"
              value={tavily}
              onChange={(e) => setTavily(e.target.value)}
              placeholder="tvly-..."
              autoComplete="off"
              spellCheck={false}
              className="mt-2 block w-full border border-stone-300 bg-stone-50 px-3 py-2 font-mono text-sm tracking-wide text-ink placeholder:text-stone-400 focus:border-ink focus:bg-white focus:outline-none"
            />
            <span className="mt-1 block font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
              Get one at tavily.com (free tier OK)
            </span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {savedAt ? (
              <span className="font-mono text-[0.7rem] uppercase tracking-widish text-accent">
                Saved at {savedAt}
              </span>
            ) : (
              <span className="font-mono text-[0.7rem] uppercase tracking-widish text-stone-500">
                Both fields required
              </span>
            )}
            <button
              type="submit"
              disabled={!anthropic.trim() || !tavily.trim()}
              className="border border-ink bg-ink px-5 py-2 font-display text-sm font-semibold uppercase tracking-widish text-stone-50 hover:bg-stone-800 disabled:cursor-not-allowed disabled:border-stone-400 disabled:bg-stone-400"
            >
              Save keys
            </button>
          </div>
        </div>
      </form>

      <p className="font-serif text-xs italic leading-relaxed text-stone-600">
        Cost reference: a typical cold dossier uses roughly $0.20–0.30 of Anthropic credit and
        ~20 Tavily searches. Caches reduce this on warm runs. You can monitor your spend
        directly at console.anthropic.com and tavily.com.
      </p>
    </article>
  );
}
