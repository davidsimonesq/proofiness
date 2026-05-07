import type {
  CreateDossierRequest,
  CreateDossierResponse,
  Dossier,
  DossierSummary,
  ProgressEvent,
} from "@crux/shared-types";

interface StreamHandlers {
  onProgress: (event: ProgressEvent) => void;
  onDone: (dossier: Dossier) => void;
  onError: (message: string) => void;
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
    handlers.onError(err instanceof Error ? err.message : String(err));
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
    handlers.onError(`Request failed (${res.status}): ${detail || "unknown error"}`);
    return;
  }

  if (!res.body) {
    handlers.onError("No response body to stream");
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
      handlers.onError(err instanceof Error ? err.message : String(err));
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
    handlers.onError(`Malformed event data: ${dataStr.slice(0, 200)}`);
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
      const { error, detail } = data as { error?: string; detail?: string };
      handlers.onError(detail ?? error ?? "unknown error");
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

export async function listDossiers(): Promise<DossierSummary[]> {
  const res = await fetch("/api/dossiers");
  if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
  const body = (await res.json()) as { dossiers: DossierSummary[] };
  return body.dossiers;
}
