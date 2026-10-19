// Prints the tag types Qloo returns for one place, so the Taste DNA grouping can match real data.
// Usage: npm run qloo:tags -- "Death & Co" "New York"
import "./_env";
import fs from "node:fs";

async function main() {
  const base = (process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com").replace(/\/$/, "");
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new Error("QLOO_API_KEY is not set in .env.local");
  const name = process.argv[2] || "Death & Co";
  const city = process.argv[3] || "New York";
  const get = async (path: string, params: Record<string, string>) => {
    const res = await fetch(`${base}${path}?${new URLSearchParams(params)}`, { headers: { "X-Api-Key": key, accept: "application/json" } });
    return (await res.json()) as Record<string, any>;
  };
  const out: string[] = [];
  const log = (s: string) => {
    console.log(s);
    out.push(s);
  };

  const s = await get("/search", { query: `${name} ${city}`, types: "urn:entity:place", take: "1" });
  const place = (Array.isArray(s.results) ? s.results : s.results?.entities ?? [])[0];
  if (!place) throw new Error("No place found");
  const id = place.entity_id ?? place.id;
  log(`PLACE ${place.name} ${id}`);

  log("\n== Tags on the place itself (name | type) ==");
  for (const t of place.tags ?? place.properties?.tags ?? []) log(`${t.name} | ${t.type ?? t.subtype ?? "?"}`);

  const i = await get("/v2/insights", { "filter.type": "urn:tag", "signal.interests.entities": id, take: "40" });
  const tags = i.results?.tags ?? (Array.isArray(i.results) ? i.results : []);
  log("\n== Insights tags (name | type | subtype | affinity) ==");
  for (const t of tags) log(`${t.name} | ${t.type ?? "?"} | ${t.subtype ?? "?"} | ${t.query?.affinity ?? t.affinity ?? "?"}`);
  log(`\nFirst insights tag raw: ${JSON.stringify(tags[0])}`);

  fs.mkdirSync("docs", { recursive: true });
  fs.writeFileSync("docs/qloo-tags.txt", out.join("\n"));
  console.log("\nSaved to docs/qloo-tags.txt");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
