// Client-side invite-code storage.
//
// The user enters their code once via InviteCodeGate; we keep it in
// localStorage so subsequent dossier requests carry it automatically. The
// API is the source of truth — if the code is invalid or revoked, the next
// /api/dossier call returns 401, and the UI prompts again.

const STORAGE_KEY = "proofiness.inviteCode";

export function getInviteCode(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setInviteCode(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code.trim());
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — silently fail;
    // the user will be re-prompted on the next request.
  }
}

export function clearInviteCode(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
