// Mock Qloo API. Same paths, params and response shapes as the hackathon API.
import { CITY_BASE, ENTITIES, NEIGHBORHOODS, NYC_RE, PLACES, TAGS, type MockEntity, type MockTag, type Vec } from "./mock-world";

const ALL: MockEntity[] = [...ENTITIES, ...PLACES];
const byId = new Map(ALL.map((x) => [x.id, x]));
const tagById = new Map(TAGS.map((x) => [x.id, x]));
const tagByName = new Map(TAGS.map((x) => [x.name.toLowerCase(), x]));

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const dot = (a: Vec, b: Vec) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: Vec) => Math.sqrt(dot(a, a)) || 1;
const cos = (a: Vec, b: Vec) => dot(a, b) / (norm(a) * norm(b));
const avg = (vs: Vec[]): Vec | null => {
  if (!vs.length) return null;
  const out: Vec = [0, 0, 0, 0, 0, 0];
  for (const v of vs) for (let i = 0; i < 6; i++) out[i] += v[i] / vs.length;
  return out;
};
/** Sharpen cosine into a 0..1 affinity with a little stable noise. */
const aff = (sig: Vec, v: Vec, key: string) => {
  const c = Math.max(0, cos(sig, v));
  return Math.round(Math.min(0.99, Math.pow(c, 2.2) * 0.96 + hash(key) * 0.04) * 1000) / 1000;
};

function splitList(v: string | undefined) {
  return (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function signalVec(params: Record<string, string>): Vec {
  const vs: Vec[] = [];
  for (const id of splitList(params["signal.interests.entities"])) {
    const x = byId.get(id);
    if (x) vs.push(x.v);
  }
  for (const id of splitList(params["signal.interests.tags"])) {
    const x = tagById.get(id);
    if (x) vs.push(x.v);
  }
  return avg(vs) ?? CITY_BASE;
}

function rawTag(x: MockTag, affinity?: number) {
  return {
    tag_id: x.id,
    id: x.id,
    name: x.name,
    type: x.type,
    subtype: x.type,
    ...(affinity !== undefined ? { query: { affinity } } : {}),
  };
}

function rawEntity(x: MockEntity, affinity?: number) {
  const typeUrn = `urn:entity:${x.kind}`;
  const tags = (x.tagNames ?? []).map((n) => tagByName.get(n.toLowerCase())).filter(Boolean) as MockTag[];
  return {
    entity_id: x.id,
    name: x.name,
    type: "urn:entity",
    subtype: typeUrn,
    types: [typeUrn],
    popularity: x.popularity ?? 0.6,
    ...(x.lat !== undefined ? { location: { lat: x.lat, lon: x.lng, geohash: "" } } : {}),
    properties: { ...(x.props ?? {}) },
    tags: tags.map((tg) => rawTag(tg)),
    ...(affinity !== undefined ? { query: { affinity } } : {}),
  };
}

function inCity(params: Record<string, string>) {
  const q = params["filter.location.query"] || params["signal.location.query"] || params["filter.location"] || "";
  return !q || NYC_RE.test(q);
}

function insights(params: Record<string, string>) {
  const type = params["filter.type"];
  const take = Number(params.take || 20);
  const sig = signalVec(params);
  const sigKey = `${params["signal.interests.entities"] ?? ""}|${params["signal.interests.tags"] ?? ""}`;

  if (type === "urn:tag") {
    const tags = TAGS.map((x) => ({ x, a: aff(sig, x.v, sigKey + x.id) }))
      .sort((a, b) => b.a - a.a)
      .slice(0, take)
      .map(({ x, a }) => rawTag(x, a));
    return { success: true, results: { tags }, duration: 31 };
  }

  if (type === "urn:demographics") {
    const [v, w, d, j, k, b] = sig;
    const s = v + w + d + j + k + b || 1;
    const rel = (x: number) => Math.round(Math.max(-1, Math.min(1, x)) * 100) / 100;
    const age = {
      "24_and_younger": rel((k * 1.2 + v * 0.3 - j * 0.6 - w * 0.3) / s),
      "25_to_29": rel((v * 0.9 + w * 0.8 + d * 1.1 + k * 0.6) / s),
      "30_to_34": rel((v * 0.6 + w * 0.9 + d * 0.6 + j * 0.6 + b * 0.5) / s),
      "35_to_44": rel((j * 1.1 + b * 0.8 + w * 0.3 - k * 0.5) / s),
      "45_to_54": rel((j * 0.6 + b * 0.3 - k * 0.8 - v * 0.2) / s),
      "55_and_older": rel((j * 0.3 - k - d * 0.3 - v * 0.3) / s),
    };
    const gender = { male: rel((v * 0.3 + k * 0.4 - d * 0.4 - b * 0.2) / s), female: rel((d * 0.4 + b * 0.3 + w * 0.2 - k * 0.2) / s) };
    const id = splitList(params["signal.interests.entities"])[0] ?? "tags";
    return { success: true, results: { demographics: [{ entity_id: id, query: { age, gender } }] }, duration: 22 };
  }

  if (type === "urn:heatmap") {
    if (!inCity(params)) return { success: true, results: { heatmap: [] }, duration: 12 };
    const cells = [];
    for (let i = 0; i < 18; i++) {
      for (let k = 0; k < 18; k++) {
        const lat = 40.66 + i * 0.0047;
        const lng = -73.995 + k * 0.0042;
        let best = 0;
        for (const n of NEIGHBORHOODS) {
          const dist = Math.hypot(lat - n.lat, (lng - n.lng) * 0.76);
          const fall = Math.exp(-(dist * dist) / 0.00012);
          best = Math.max(best, fall * Math.max(0, cos(sig, n.v)));
        }
        const v = Math.round((best * 0.92 + hash(`${i}-${k}`) * 0.08) * 1000) / 1000;
        cells.push({ location: { latitude: lat, longitude: lng, geohash: "" }, query: { affinity: v, affinity_rank: v, popularity: v } });
      }
    }
    return { success: true, results: { heatmap: cells }, duration: 40 };
  }

  if (type?.startsWith("urn:entity:")) {
    const kind = type.slice("urn:entity:".length);
    const exclude = new Set(splitList(params["filter.exclude.entities"]));
    const only = splitList(params["filter.results.entities"]);
    let pool = ALL.filter((x) => x.kind === kind || (kind === "place" && x.kind === "place"));
    if (kind === "place") {
      pool = pool.filter((x) => (params["filter.tags"] === "dining" ? x.props?.kindLabel === "dining" : !x.props?.kindLabel));
      if (!inCity(params)) pool = [];
    }
    if (only.length) pool = ALL.filter((x) => only.includes(x.id));
    pool = pool.filter((x) => !exclude.has(x.id) && !splitList(params["signal.interests.entities"]).includes(x.id));
    const entities = pool
      .map((x) => ({ x, a: aff(sig, x.v, sigKey + x.id) }))
      .sort((a, b) => b.a - a.a)
      .slice(0, only.length ? only.length : take)
      .map(({ x, a }) => rawEntity(x, a));
    return { success: true, results: { entities }, duration: 37 };
  }
  return { success: false, error: { message: `Unsupported filter.type ${type}` } };
}

export function mockQloo(path: string, params: Record<string, string>): { status: number; body: unknown } {
  if (path === "/search") {
    const q = (params.query ?? "").toLowerCase().trim();
    const types = splitList(params.types);
    const take = Number(params.take || 10);
    const pool = ALL.filter((x) => !x.props?.kindLabel).filter((x) => !types.length || types.includes(`urn:entity:${x.kind}`));
    const words = q.split(/\s+/).filter((w) => w.length > 1);
    const scored = pool
      .map((x) => {
        const hay = `${x.name} ${(x.tagNames ?? []).join(" ")} ${String(x.props?.neighborhood ?? "")}`.toLowerCase();
        const score = x.name.toLowerCase().includes(q) ? 3 : words.filter((w) => hay.includes(w)).length;
        return { x, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, take);
    return { status: 200, body: { results: scored.map((s) => rawEntity(s.x)) } };
  }
  if (path === "/entities") {
    const ids = splitList(params.entity_ids);
    return { status: 200, body: { success: true, results: ids.map((id) => byId.get(id)).filter(Boolean).map((x) => rawEntity(x as MockEntity)) } };
  }
  if (path === "/v2/tags") {
    const q = (params["filter.query"] ?? "").toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const take = Number(params.take || 10);
    const tags = TAGS.filter((x) => {
      const n = x.name.toLowerCase();
      return n.includes(q) || words.some((w) => n.includes(w));
    })
      .slice(0, take)
      .map((x) => rawTag(x));
    return { status: 200, body: { success: true, results: { tags } } };
  }
  if (path === "/v2/insights") {
    const body = insights(params);
    return { status: (body as { success: boolean }).success ? 200 : 400, body };
  }
  if (path === "/v2/audiences") {
    return { status: 200, body: { success: true, results: { audiences: [] } } };
  }
  return { status: 404, body: { error: "not found" } };
}
