// Handoff store for "user just minted a code via the request-invite flow,
// auto-start their first dossier on the same claim." We use sessionStorage
// (not URL state) so the claim text doesn't show up in the address bar or
// in shared links.

const STORAGE_KEY = "proofiness.pendingClaim";

export function setPendingClaim(claim: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, claim);
  } catch {
    /* ignore */
  }
}

// Consume — returns the claim if present and CLEARS it (so a refresh of the
// app route doesn't re-trigger the auto-submit).
export function consumePendingClaim(): string | null {
  try {
    const v = window.sessionStorage.getItem(STORAGE_KEY);
    if (v) window.sessionStorage.removeItem(STORAGE_KEY);
    return v;
  } catch {
    return null;
  }
}
