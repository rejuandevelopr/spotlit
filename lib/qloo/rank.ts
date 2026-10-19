import type { RawPlace } from "./parse";

const STOP = new Set(["the", "and", "co", "company", "of", "a", "an", "nyc", "bar", "cafe", "restaurant"]);

const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t && !STOP.has(t));

const CITY_STATE: Record<string, string> = {
  "new york": "NY", brooklyn: "NY", manhattan: "NY", queens: "NY",
  "los angeles": "CA", "san francisco": "CA", oakland: "CA", "san diego": "CA",
  chicago: "IL", austin: "TX", houston: "TX", dallas: "TX",
  miami: "FL", seattle: "WA", portland: "OR", boston: "MA",
  philadelphia: "PA", atlanta: "GA", denver: "CO", "new orleans": "LA",
  nashville: "TN", "washington": "DC",
};

/** How well a place name matches what was typed, from 0 to 1. */
export function nameScore(query: string, name: string): number {
  const q = tokens(query);
  const n = tokens(name);
  if (!q.length || !n.length) return 0;
  // Prefix matches only count for words of 3+ letters, so "hi" does not match "hip".
  const near = (a: string, b: string) => a === b || (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a)));
  const hits = q.filter((t) => n.some((w) => near(w, t))).length;
  let score = hits / q.length;
  if (n.join(" ").startsWith(q.join(" "))) score += 0.5;
  return score;
}

/** True when the address clearly sits in another US state than the chosen city. */
export function outOfCity(address: string | null, city: string | null): boolean {
  if (!address || !city) return false;
  const want = CITY_STATE[city.trim().toLowerCase()];
  if (!want) return false;
  const m = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
  return !!m && m[1] !== want;
}

/** Best name matches first, places in another state dropped, weak matches dropped when strong ones exist. */
export function rankPlaces(query: string, city: string | null, places: RawPlace[], take: number): RawPlace[] {
  const scored = places
    .filter((p) => !p.isClosed && !outOfCity(p.address, city))
    .map((p, i) => ({ p, s: nameScore(query, p.name), i }));
  const best = Math.max(0, ...scored.map((x) => x.s));
  const floor = best >= 1 ? 0.5 : 0;
  const seen = new Set<string>();
  return scored
    .filter((x) => x.s >= floor)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p)
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .slice(0, take);
}
