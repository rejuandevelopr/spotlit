import { env } from "@/lib/env";

/**
 * Links saved while running locally (the demo seed, a test card) can point at localhost.
 * Rewrite them to the deployed app URL so outside agents and guests get a working link.
 */
export function publicLink(u: string | null | undefined): string | null {
  if (!u) return null;
  const m = u.match(/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/.*)?$/i);
  if (!m) return u;
  return `${env.appUrl}${m[1] ?? ""}`;
}
