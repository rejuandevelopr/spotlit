// Day 1 smoke test: one real call per Qloo endpoint Spotlit uses. Prints status, latency,
// result count and the shape of the first result, and writes docs/qloo-capabilities.md.
// Usage: npm run qloo:smoke   (needs QLOO_API_KEY in .env.local)
import "./_env";
import fs from "node:fs";

type Row = { name: string; path: string; params: Record<string, string>; status?: number; ms?: number; count?: number; shape?: string; error?: string };

async function main() {
  const base = (process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com").replace(/\/$/, "");
  const key = process.env.QLOO_API_KEY;
  if (!key) {
    console.error("QLOO_API_KEY is not set. Add it to .env.local first.");
    process.exit(1);
  }
  const city = process.argv[2] || process.env.DEMO_CITY || "New York";

  const call = async (path: string, params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    const t = Date.now();
    const res = await fetch(`${base}${path}?${qs}`, { headers: { "X-Api-Key": key, accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, ms: Date.now() - t, body };
  };
  const list = (b: unknown): unknown[] => {
    const o = b as Record<string, unknown>;
    if (Array.isArray(o?.results)) return o.results as unknown[];
    const r = (o?.results ?? {}) as Record<string, unknown>;
    for (const k of ["entities", "tags", "demographics", "heatmap", "audiences"]) if (Array.isArray(r[k])) return r[k] as unknown[];
    return [];
  };
  const shape = (x: unknown, depth = 0): string => {
    if (x === null || typeof x !== "object") return typeof x;
    if (Array.isArray(x)) return `[${x.length ? shape(x[0], depth + 1) : ""}]`;
    if (depth > 2) return "{…}";
    return `{${Object.entries(x as Record<string, unknown>)
      .slice(0, 12)
      .map(([k, v]) => `${k}: ${shape(v, depth + 1)}`)
      .join(", ")}}`;
  };

  // 1. Find a place and a seed artist to use as signals.
  const placeSearch = await call("/search", { query: `jazz bar ${city}`, types: "urn:entity:place", take: "3" });
  const place = list(placeSearch.body)[0] as Record<string, unknown> | undefined;
  const placeId = String(place?.entity_id ?? place?.id ?? "");
  const artistSearch = await call("/search", { query: "Khruangbin", types: "urn:entity:artist", take: "1" });
  const artist = list(artistSearch.body)[0] as Record<string, unknown> | undefined;
  const artistId = String(artist?.entity_id ?? artist?.id ?? "");
  const tagSearch = await call("/v2/tags", { "filter.query": "natural wine", take: "3" });
  const tag = list(tagSearch.body)[0] as Record<string, unknown> | undefined;
  const tagId = String(tag?.tag_id ?? tag?.id ?? "");
  console.log(`Place: ${place?.name ?? "none"} (${placeId})\nArtist: ${artist?.name ?? "none"} (${artistId})\nTag: ${tag?.name ?? "none"} (${tagId})\n`);

  const rows: Row[] = [
    { name: "searchPlaces", path: "/search", params: { query: `wine bar ${city}`, types: "urn:entity:place", take: "5" } },
    { name: "getEntities", path: "/entities", params: { entity_ids: placeId } },
    { name: "searchTags", path: "/v2/tags", params: { "filter.query": "vinyl", take: "5" } },
    { name: "listAudiences", path: "/v2/audiences", params: { take: "5" } },
    { name: "venueTags", path: "/v2/insights", params: { "filter.type": "urn:tag", "signal.interests.entities": placeId, take: "10" } },
    { name: "describedTags", path: "/v2/insights", params: { "filter.type": "urn:tag", "signal.interests.tags": tagId, take: "10" } },
    { name: "venueDemographics", path: "/v2/insights", params: { "filter.type": "urn:demographics", "signal.interests.entities": placeId } },
    { name: "crossDomain artist", path: "/v2/insights", params: { "filter.type": "urn:entity:artist", "signal.interests.entities": placeId, take: "5" } },
    { name: "crossDomain movie", path: "/v2/insights", params: { "filter.type": "urn:entity:movie", "signal.interests.entities": placeId, take: "5" } },
    { name: "crossDomain brand", path: "/v2/insights", params: { "filter.type": "urn:entity:brand", "signal.interests.entities": placeId, take: "5" } },
    { name: "tasteRivals", path: "/v2/insights", params: { "filter.type": "urn:entity:place", "filter.location.query": city, "signal.interests.entities": placeId, take: "8" } },
    { name: "cityTags", path: "/v2/insights", params: { "filter.type": "urn:tag", "signal.location.query": city, take: "20" } },
    { name: "personaTags", path: "/v2/insights", params: { "filter.type": "urn:tag", "signal.interests.entities": artistId, take: "20" } },
    { name: "scoreCandidates", path: "/v2/insights", params: { "filter.type": "urn:entity:place", "signal.interests.entities": artistId, "filter.results.entities": placeId, take: "5" } },
    { name: "heatmap", path: "/v2/insights", params: { "filter.type": "urn:heatmap", "filter.location.query": city, "signal.interests.entities": placeId } },
  ];

  for (const row of rows) {
    try {
      const r = await call(row.path, row.params);
      const items = list(r.body);
      row.status = r.status;
      row.ms = r.ms;
      row.count = items.length;
      row.shape = items.length ? shape(items[0]) : shape(r.body).slice(0, 200);
    } catch (err) {
      row.error = (err as Error).message;
    }
    console.log(`${row.status === 200 && row.count ? "OK  " : "WARN"} ${row.name.padEnd(20)} ${String(row.status ?? "ERR").padEnd(4)} ${String(row.ms ?? "").padStart(5)}ms  ${row.count ?? 0} results`);
  }

  fs.mkdirSync("docs", { recursive: true });
  const md = [
    `# Qloo capabilities (smoke test, ${new Date().toISOString()})`,
    "",
    `Base URL: ${base} · City: ${city}`,
    "",
    "| Function | Endpoint | Status | ms | Results |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((r) => `| ${r.name} | \`${r.path}\` | ${r.status ?? "error"} | ${r.ms ?? ""} | ${r.count ?? 0} |`),
    "",
    "## First result shapes",
    "",
    ...rows.map((r) => `### ${r.name}\n\n\`\`\`\n${r.shape ?? r.error ?? ""}\n\`\`\`\n`),
  ].join("\n");
  fs.writeFileSync("docs/qloo-capabilities.md", md);
  console.log("\nWrote docs/qloo-capabilities.md");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
