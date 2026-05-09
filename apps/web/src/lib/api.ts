import type {
  CreateDossierRequest,
  CreateDossierResponse,
  Dossier,
  DossierList,
  ProgressEvent,
} from "@proofiness/shared-types";
import { getInviteCode } from "./invites.js";
import { getUserKeys, hasFullByokKeys } from "./keys.js";

// VITE_API_BASE_URL: when the web app and API are on different origins
// (e.g. web on SiteGround, API on Railway), set this to the absolute API
// base (e.g. "https://api.proofiness.org"). When unset (or empty), all
// requests go to the same origin via relative URLs — which is what the
// dev server uses (vite proxy) and what same-origin deploys use.
const API_BASE = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "");

function apiUrl(path: string): string {
  return API_BASE ? `${API_BASE}${path}` : path;
}

// Browser-side header builder. Sends BYOK keys when both are stored; falls
// back to the invite code otherwise. The two are mutually exclusive — if the
// user has set personal keys, the server bypasses the cost gate entirely
// (they're paying directly), so the invite header isn't needed.
function authHeaders(): Record<string, string> {
  if (hasFullByokKeys()) {
    const { anthropic, tavily } = getUserKeys();
    // hasFullByokKeys guarantees both are non-null but TS narrowing doesn't follow that.
    return {
      "x-anthropic-key": anthropic ?? "",
      "x-tavily-key": tavily ?? "",
    };
  }
  const code = getInviteCode();
  return code ? { "x-invite-code": code } : {};
}

// Structured error variants the client can render distinctly.
//   - "claim_rejected": normalization refused the claim; suggestions present
//   - "invite_required": API rejected the request for missing/invalid invite
//   - "quota_exceeded": API rejected for exceeding the daily dossier cap
//   - "generic": pipeline failure or any other error
// requestId is server-generated (Fastify reqId) and lets the user grep server
// logs for a specific failure when reporting an issue.
export type DossierError =
  | {
      kind: "claim_rejected";
      status: "too_vague" | "not_a_claim";
      reason: string;
      suggestions: string[];
      requestId?: string;
    }
  | { kind: "invite_required"; reason: string }
  | { kind: "quota_exceeded"; reason: string }
  | { kind: "generic"; message: string; requestId?: string };

interface StreamHandlers {
  onProgress: (event: ProgressEvent) => void;
  onDone: (dossier: Dossier) => void;
  onError: (err: DossierError) => void;
}

// Streaming dossier generation. Consumes the SSE response line-by-line and
// dispatches typed events. Does NOT use EventSource (which only supports GET).
export async function streamDossier(
  req: CreateDossierRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/dossier"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        ...authHeaders(),
      },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError({ kind: "generic", message: err instanceof Error ? err.message : String(err) });
    return;
  }

  if (!res.ok) {
    let body: { error?: string; detail?: string } = {};
    try {
      body = (await res.json()) as { error?: string; detail?: string };
    } catch {
      // body wasn't JSON; fall through with empty body
    }
    // Cost-gate failures come back as plain JSON 401/429 (NOT inside an SSE
    // event), because the gate runs before the stream is opened.
    if (res.status === 401 && body.error === "invite_required") {
      handlers.onError({
        kind: "invite_required",
        reason: body.detail ?? "An invite code is required to use Proofiness.",
      });
      return;
    }
    if (res.status === 429 && body.error === "quota_exceeded") {
      handlers.onError({
        kind: "quota_exceeded",
        reason: body.detail ?? "Daily dossier limit reached for your invite code.",
      });
      return;
    }
    const detail = body.detail ?? body.error ?? "";
    handlers.onError({
      kind: "generic",
      message: `Request failed (${res.status})${detail ? `: ${detail}` : ""}`,
    });
    return;
  }

  if (!res.body) {
    handlers.onError({ kind: "generic", message: "No response body to stream" });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line ("\n\n").
      let separatorIdx: number;
      while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIdx);
        buffer = buffer.slice(separatorIdx + 2);
        dispatchSseEvent(rawEvent, handlers);
      }
    }
  } catch (err) {
    if ((err as Error).name !== "AbortError") {
      handlers.onError({ kind: "generic", message: err instanceof Error ? err.message : String(err) });
    }
  } finally {
    reader.releaseLock();
  }
}

function dispatchSseEvent(rawEvent: string, handlers: StreamHandlers): void {
  let eventName = "message";
  const dataLines: string[] = [];
  for (const line of rawEvent.split("\n")) {
    if (line.startsWith(":")) continue; // comment / heartbeat
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  const dataStr = dataLines.join("\n");

  let data: unknown;
  try {
    data = JSON.parse(dataStr);
  } catch {
    handlers.onError({ kind: "generic", message: `Malformed event data: ${dataStr.slice(0, 200)}` });
    return;
  }

  switch (eventName) {
    case "progress":
      handlers.onProgress(data as ProgressEvent);
      break;
    case "done": {
      const { dossier } = data as { dossier: Dossier };
      handlers.onDone(dossier);
      break;
    }
    case "error": {
      const body = data as {
        error?: string;
        detail?: string;
        suggestions?: string[];
        requestId?: string;
      };
      // Structured rejection from the normalize step — surface the suggestions.
      if (body.error === "too_vague" || body.error === "not_a_claim") {
        handlers.onError({
          kind: "claim_rejected",
          status: body.error,
          reason: body.detail ?? "The claim couldn't be processed.",
          suggestions: body.suggestions ?? [],
          requestId: body.requestId,
        });
      } else {
        handlers.onError({
          kind: "generic",
          message: body.detail ?? body.error ?? "unknown error",
          requestId: body.requestId,
        });
      }
      break;
    }
    default:
      // unknown event name — ignore for forward compatibility
      break;
  }
}

// One-shot retrieval — used by the share URL and history view. Read-only
// endpoints aren't gated by the invite code; reading saved dossiers is free.
export async function getDossier(id: string): Promise<Dossier> {
  const res = await fetch(apiUrl(`/api/dossier/${encodeURIComponent(id)}`));
  if (!res.ok) {
    if (res.status === 404) throw new Error("Dossier not found");
    throw new Error(`Failed to load dossier (${res.status})`);
  }
  const body = (await res.json()) as CreateDossierResponse;
  return body.dossier;
}

// Self-service invite mint. Submits a claim; server runs the normalizer on
// it. Returns a discriminated union the form renders directly.
export type RequestInviteResult =
  | { status: "approved"; code: string; normalizedClaim: string }
  | { status: "needs_more_detail"; reason: string; suggestions: string[] }
  | { status: "feature_disabled"; detail: string }
  | { status: "daily_cap_reached"; detail: string }
  | { status: "ip_rate_limit"; detail: string }
  | { status: "invalid_request"; detail: string }
  | { status: "error"; detail: string };

export async function requestInvite(claim: string): Promise<RequestInviteResult> {
  let res: Response;
  try {
    res = await fetch(apiUrl("/api/request-invite"), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ claim }),
    });
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    return {
      status: "error",
      detail: `Server returned ${res.status} with no JSON body`,
    };
  }

  if (res.ok) {
    if (body.status === "approved" && typeof body.code === "string") {
      return {
        status: "approved",
        code: body.code,
        normalizedClaim: typeof body.normalizedClaim === "string" ? body.normalizedClaim : claim,
      };
    }
    if (body.status === "needs_more_detail") {
      return {
        status: "needs_more_detail",
        reason: typeof body.reason === "string" ? body.reason : "Please refine your claim.",
        suggestions: Array.isArray(body.suggestions)
          ? (body.suggestions as unknown[]).filter((s): s is string => typeof s === "string")
          : [],
      };
    }
    return { status: "error", detail: `Unexpected response shape: ${JSON.stringify(body).slice(0, 200)}` };
  }

  // Map known error codes to typed variants the form can render distinctly.
  const errorCode = typeof body.error === "string" ? body.error : "";
  const detail = typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`;
  if (errorCode === "feature_disabled") return { status: "feature_disabled", detail };
  if (errorCode === "daily_cap_reached") return { status: "daily_cap_reached", detail };
  if (errorCode === "ip_rate_limit") return { status: "ip_rate_limit", detail };
  if (errorCode === "invalid_request") return { status: "invalid_request", detail };
  return { status: "error", detail };
}

export async function listDossiers(opts: { cursor?: string; limit?: number } = {}): Promise<DossierList> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = qs ? apiUrl(`/api/dossiers?${qs}`) : apiUrl("/api/dossiers");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  return (await res.json()) as DossierList;
}
