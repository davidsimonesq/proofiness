import { useEffect, useState } from "react";

// Minimal hash-based router. Avoids react-router dependency. Routes:
//   #/             → landing page (marketing / value-prop)
//   #/app          → the app itself (input + history)
//   #/dossier/:id  → view a saved dossier (permalink, shareable)
//   #/about        → about the project
//   #/privacy      → privacy practices
//   #/terms        → terms of use
//   #/help         → help / how to read a dossier
//
// Hash routing keeps everything client-side (no server config needed) and
// works behind any static host.

export type StaticPageSlug = "about" | "privacy" | "terms" | "help";

export type Route =
  | { kind: "landing" }
  | { kind: "app" }
  | { kind: "dossier"; id: string }
  | { kind: "static"; slug: StaticPageSlug }
  | { kind: "settings" }
  | { kind: "unknown" };

const STATIC_SLUGS: ReadonlySet<string> = new Set(["about", "privacy", "terms", "help"]);

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#/, "").replace(/^\/+/, "");
  if (cleaned === "" || cleaned === "/") return { kind: "landing" };
  if (cleaned === "app") return { kind: "app" };
  if (cleaned === "settings") return { kind: "settings" };
  const dossierMatch = cleaned.match(/^dossier\/([a-z0-9-]+)$/i);
  if (dossierMatch) return { kind: "dossier", id: dossierMatch[1]! };
  if (STATIC_SLUGS.has(cleaned)) return { kind: "static", slug: cleaned as StaticPageSlug };
  return { kind: "unknown" };
}

export const APP_HASH = "#/app";
export const LANDING_HASH = "#/";
export const SETTINGS_HASH = "#/settings";

export function buildDossierHash(id: string): string {
  return `#/dossier/${id}`;
}

export function buildStaticHash(slug: StaticPageSlug): string {
  return `#/${slug}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(hash: string): void {
  window.location.hash = hash;
}
