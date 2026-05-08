// Per-request key context using Node's AsyncLocalStorage.
//
// BYOK ("bring your own keys") lets a user supply their own Anthropic +
// Tavily keys via request headers, bypassing the cost gate (since they're
// paying directly). Without context-scoping, the pipeline would have to
// thread keys through every function call. With it, getAnthropic() and
// getSearchProvider() pull keys from the active request's context — pipeline
// signatures stay clean.
//
// The route handler wraps the work in `requestContext.run({...}, async () => {})`.
// Anything inside that run (including async pipeline steps) reads the same
// context; concurrent requests get their own contexts.
//
// Keys here are NEVER logged, stored to disk, or persisted between requests.
// They live in memory for the duration of the request handler.

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestKeys {
  anthropicKey?: string;
  tavilyKey?: string;
}

export const requestContext = new AsyncLocalStorage<RequestKeys>();

export function getRequestAnthropicKey(): string | undefined {
  return requestContext.getStore()?.anthropicKey;
}

export function getRequestTavilyKey(): string | undefined {
  return requestContext.getStore()?.tavilyKey;
}
