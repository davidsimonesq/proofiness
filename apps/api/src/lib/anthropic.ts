import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in.");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export type AnthropicErrorCategory =
  | "rate_limit"
  | "server_error"
  | "authentication"
  | "permission_denied"
  | "bad_request"
  | "not_found"
  | "network"
  | "other";

export interface CategorizedError {
  category: AnthropicErrorCategory;
  message: string;
  status?: number;
  // Whether the SDK might recover on its own (the SDK auto-retries 408/409/429/5xx
  // and connection errors with exponential backoff). True here means "the
  // underlying issue could resolve" — useful for distinguishing logged warnings
  // from logged errors.
  retryable: boolean;
}

// Categorizes a thrown error from a `client.messages.create()` (or similar) call.
// Use to give pipeline catch blocks structured logging without scattering
// `instanceof` checks through every module.
export function categorizeAnthropicError(err: unknown): CategorizedError {
  if (err instanceof Anthropic.RateLimitError) {
    return { category: "rate_limit", message: err.message, status: err.status, retryable: true };
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return { category: "authentication", message: err.message, status: err.status, retryable: false };
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return { category: "permission_denied", message: err.message, status: err.status, retryable: false };
  }
  if (err instanceof Anthropic.NotFoundError) {
    return { category: "not_found", message: err.message, status: err.status, retryable: false };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { category: "bad_request", message: err.message, status: err.status, retryable: false };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { category: "network", message: err.message, retryable: true };
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    return {
      category: status >= 500 ? "server_error" : "other",
      message: err.message,
      status,
      retryable: status >= 500,
    };
  }
  return {
    category: "other",
    message: err instanceof Error ? err.message : String(err),
    retryable: false,
  };
}

// Helper for pipeline modules: log a categorized error with module context.
// Authentication errors get logged loud (they indicate a config problem, not
// a transient failure). Rate limits and server errors are noisy but normal.
export function logAnthropicError(
  module: string,
  subject: string,
  err: unknown,
): CategorizedError {
  const cat = categorizeAnthropicError(err);
  const tag = `[${module}]`;
  const detail = cat.status ? `${cat.category} ${cat.status}` : cat.category;
  const line = `${tag} LLM call failed for ${JSON.stringify(subject)} (${detail}, retryable=${cat.retryable}): ${cat.message}`;
  if (cat.category === "authentication") {
    console.error(`${line}\n[${module}] ANTHROPIC_API_KEY is invalid — fix and restart.`);
  } else {
    console.error(line);
  }
  return cat;
}
