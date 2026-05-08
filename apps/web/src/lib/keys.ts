// Client-side BYOK ("bring your own keys") storage.
//
// User's Anthropic + Tavily keys live in localStorage. They're sent as
// per-request headers (x-anthropic-key, x-tavily-key) when both are set.
// Server uses them for the request and never stores them.
//
// Both must be set together — partial setup is treated as a config error
// by the server (returns 400). The Settings UI enforces this client-side
// by only allowing "Save" when both fields are non-empty.

const ANTHROPIC_KEY_STORAGE = "proofiness.byok.anthropic";
const TAVILY_KEY_STORAGE = "proofiness.byok.tavily";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value.trim());
  } catch {
    /* ignore — private mode, quota, etc. */
  }
}

export interface UserKeys {
  anthropic: string | null;
  tavily: string | null;
}

export function getUserKeys(): UserKeys {
  return {
    anthropic: read(ANTHROPIC_KEY_STORAGE),
    tavily: read(TAVILY_KEY_STORAGE),
  };
}

// True only when BOTH keys are present. The server requires both or neither;
// the UI uses this to decide whether to send BYOK headers and whether to skip
// the invite-code gate.
export function hasFullByokKeys(): boolean {
  const k = getUserKeys();
  return Boolean(k.anthropic && k.tavily);
}

export function setUserKeys(anthropic: string, tavily: string): void {
  write(ANTHROPIC_KEY_STORAGE, anthropic);
  write(TAVILY_KEY_STORAGE, tavily);
}

export function clearUserKeys(): void {
  write(ANTHROPIC_KEY_STORAGE, null);
  write(TAVILY_KEY_STORAGE, null);
}

// Visual-aid mask. We never echo the full key back in the UI; show first
// few + last few characters so the user can confirm what they pasted.
export function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}
