import type {
  CreateDossierRequest,
  CreateDossierResponse,
  Dossier,
  DossierList,
  ProgressEvent,
} from "@crux/shared-types";

// Structured error variants the client can render distinctly.
//   - "claim_rejected": normalization refused the claim; suggestions present
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
    res = await fetch("/api/dossier", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(req),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    handlers.onError({ kind: "generic", message: err instanceof Error ? err.message : String(err) });
    return;
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string; detail?: string };
      detail = body.detail ?? body.error ?? "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    handlers.onError({ kind: "generic", message: `Request failed (${res.status}): ${detail || "unknown error"}` });
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

// One-shot retrieval — used by the share URL and history view.
export async function getDossier(id: string): Promise<Dossier> {
  const res = await fetch(`/api/dossier/${encodeURIComponent(id)}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("Dossier not found");
    throw new Error(`Failed to load dossier (${res.status})`);
  }
  const body = (await res.json()) as CreateDossierResponse;
  return body.dossier;
}

export async function listDossiers(opts: { cursor?: string; limit?: number } = {}): Promise<DossierList> {
  const params = new URLSearchParams();
  if (opts.cursor) params.set("cursor", opts.cursor);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = qs ? `/api/dossiers?${qs}` : "/api/dossiers";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  return (await res.json()) as DossierList;
}
