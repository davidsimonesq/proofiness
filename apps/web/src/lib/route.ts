import { useEffect, useState } from "react";

// Minimal hash-based router. Avoids react-router dependency. Routes:
//   #/             → home (input + history)
//   #/dossier/:id  → view a saved dossier
//
// Hash routing keeps everything client-side (no server config needed) and
// works behind any static host.

export type Route =
  | { kind: "home" }
  | { kind: "dossier"; id: string }
  | { kind: "unknown" };

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#/, "").replace(/^\/+/, "");
  if (cleaned === "" || cleaned === "/") return { kind: "home" };
  const dossierMatch = cleaned.match(/^dossier\/([a-z0-9-]+)$/i);
  if (dossierMatch) return { kind: "dossier", id: dossierMatch[1]! };
  return { kind: "unknown" };
}

export function buildDossierHash(id: string): string {
  return `#/dossier/${id}`;
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
