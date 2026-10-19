// Defensive parsers that turn raw Qloo responses into the small shapes Spotlit uses.
// They tolerate small shape differences between API versions.
import type { EntityRef, TagRef } from "@/lib/types";

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export interface RawPlace {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tags: TagRef[];
  affinity: number | null;
  priceLevel: number | null;
  hours: Record<string, string> | null;
  website: string | null;
  rating: number | null;
  neighborhood: string | null;
  isClosed: boolean;
  types: string[];
}

export function entityId(e: Raw): string {
  return str(e.entity_id) ?? str(e.id) ?? str(e.qloo_id) ?? "";
}

export function affinityOf(e: Raw): number | null {
  const q = obj(e.query);
  return num(q.affinity) ?? num(e.affinity) ?? num(q.score) ?? null;
}

// Qloo puts the tag kind in `subtype`, for example urn:tag:specialty_dish:place or urn:tag:credit_card:place.
const NOISE_RE = /(credit_card|payment|price|rating|star|accessib|wheelchair|parking|wifi|reservation|amenit|hours|delivery|takeout|good_for|children|restroom|service_option)/i;
const DINING_RE = /(specialty_dish|dish|cuisine|menu|drink|beverage)/i;

// Generic style tags such as "Pop Vibe", "Disco-Bar Aesthetic" or "Music Pub Decor" say little about a venue
// and crowd out the useful ones, so they are treated as noise everywhere (display and scoring).
const STYLE_NAME_RE = /(^|[\s-])(vibes?|style|aesthetic|decor|ambiance|ambience|atmosphere)$/i;

const STEM_FILLER = new Set(["like", "ish", "themed", "theme", "oriented", "inspired", "style", "styled", "setting", "environment", "interiors", "interior", "vibe", "vibes", "aesthetic", "music", "the", "a"]);

/** Root word of a tag, so "Nightclub-Like", "Nightclubish" and "Nightclub-themed" share the stem "nightclub". */
export function tagStem(name: string): string {
  const words = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((w) => (w.length > 5 && w.endsWith("ish") ? w.slice(0, -3) : w))
    .filter((w) => !STEM_FILLER.has(w));
  return words[0] ?? name.toLowerCase();
}

/**
 * For display only: keep the strongest tag per stem so the tag cloud shows several ideas,
 * not five spellings of one. Scoring still uses the full tag list.
 */
export function distinctTags<T extends { name: string }>(tags: T[]): T[] {
  const seen = new Set<string>();
  return tags.filter((t) => {
    const k = tagStem(t.name);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export type TagKind = "noise" | "dining" | "taste";

export function tagKind(t: { id: string; name: string; type?: string }): TagKind {
  const kind = `${t.type ?? ""} ${t.id}`;
  if (NOISE_RE.test(kind) || /\bstars?\b/i.test(t.name) || STYLE_NAME_RE.test(t.name.trim())) return "noise";
  if (DINING_RE.test(kind)) return "dining";
  return "taste";
}

export function parseTags(v: unknown, limit = 30): TagRef[] {
  return arr(v)
    .map((t) => {
      const o = obj(t);
      const id = str(o.tag_id) ?? str(o.id) ?? "";
      const name = str(o.name) ?? "";
      return { id, name, type: str(o.subtype) ?? str(o.type) ?? undefined, affinity: affinityOf(o) ?? undefined } as TagRef;
    })
    .filter((t) => t.id && t.name && tagKind(t) !== "noise")
    .slice(0, limit);
}

/** Entities live in results.entities (insights), results (search) or results.entities (entities). */
export function entityList(data: unknown): Raw[] {
  const d = obj(data);
  const results = d.results;
  if (Array.isArray(results)) return results.map(obj);
  const r = obj(results);
  if (Array.isArray(r.entities)) return r.entities.map(obj);
  if (Array.isArray(d.entities)) return d.entities.map(obj);
  return [];
}

export function tagList(data: unknown): Raw[] {
  const d = obj(data);
  const r = obj(d.results);
  if (Array.isArray(r.tags)) return r.tags.map(obj);
  if (Array.isArray(d.results)) return (d.results as unknown[]).map(obj);
  if (Array.isArray(d.tags)) return d.tags.map(obj);
  return [];
}

/** Qloo sends times like "T18:00" or "18:00:00". Returns "18:00". Also repairs old truncated values like "T18:0". */
export function normTime(v: string): string {
  const m = v.trim().replace(/^T/i, "").match(/^(\d{1,2})(?::(\d{1,2}))?/);
  if (!m) return v.trim();
  return `${m[1].padStart(2, "0")}:${(m[2] ?? "0").padEnd(2, "0")}`;
}

/** Normalises a stored "open-close" range, leaving "closed" and empty values alone. */
export function normRange(v: string): string {
  if (!v || v === "closed" || !v.includes("-")) return v;
  const [o, c] = v.split("-");
  return `${normTime(o)}-${normTime(c)}`;
}

function parseHours(v: unknown): Record<string, string> | null {
  const o = obj(v);
  const keys = Object.keys(o);
  if (!keys.length) return null;
  const map: Record<string, string> = {};
  const dayKey: Record<string, string> = {
    monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
  };
  for (const k of keys) {
    const day = dayKey[k.toLowerCase()] ?? k.toLowerCase().slice(0, 3);
    const val = o[k];
    const first = obj(arr(val)[0]);
    const opens = str(first.opens);
    const closes = str(first.closes);
    if (opens && closes) map[day] = `${normTime(opens)}-${normTime(closes)}`;
    else if (typeof val === "string") map[day] = val;
  }
  return Object.keys(map).length ? map : null;
}

export function parsePlace(e: Raw): RawPlace {
  const props = obj(e.properties);
  const loc = obj(e.location);
  const geocode = obj(props.geocode);
  return {
    id: entityId(e),
    name: str(e.name) ?? "Unknown place",
    address: str(props.address) ?? null,
    lat: num(loc.lat) ?? num(loc.latitude) ?? null,
    lng: num(loc.lon) ?? num(loc.lng) ?? num(loc.longitude) ?? null,
    tags: parseTags(e.tags, 25),
    affinity: affinityOf(e),
    priceLevel: num(props.price_level) ?? null,
    hours: parseHours(props.hours),
    website: str(props.website) ?? null,
    rating: num(props.business_rating) ?? null,
    neighborhood: str(props.neighborhood) ?? str(geocode.name) ?? null,
    isClosed: props.is_closed === true,
    types: arr(e.types).map((t) => String(t)),
  };
}

export function parseEntityRefs(data: unknown, type: string, limit = 10): EntityRef[] {
  return entityList(data)
    .map((e) => {
      const props = obj(e.properties);
      return {
        id: entityId(e),
        name: str(e.name) ?? "",
        type,
        affinity: affinityOf(e) ?? undefined,
        subtitle: str(props.short_description) ?? str(e.disambiguation) ?? undefined,
      } as EntityRef;
    })
    .filter((e) => e.id && e.name)
    .slice(0, limit);
}

const AGE_LABELS: Record<string, string> = {
  "24_and_younger": "18 to 24",
  "25_to_29": "25 to 29",
  "30_to_34": "30 to 34",
  "35_to_44": "35 to 44",
  "45_to_54": "45 to 54",
  "55_and_older": "55 plus",
};

/** Demographics come back as relative affinities, roughly -1..1. We map them to 0..1 for bars. */
export function parseDemographics(data: unknown): { bands: { band: string; value: number }[]; gender: string | null } {
  const d = obj(data);
  const r = obj(d.results);
  const first = obj(arr(r.demographics)[0] ?? arr(d.results)[0]);
  const q = obj(first.query);
  const age = obj(q.age);
  const bands = Object.entries(age)
    .filter(([, v]) => typeof v === "number")
    .map(([k, v]) => ({ band: AGE_LABELS[k] ?? k.replace(/_/g, " "), value: Math.max(0, Math.min(1, ((v as number) + 1) / 2)) }));
  const gender = obj(q.gender);
  const m = num(gender.male) ?? 0;
  const f = num(gender.female) ?? 0;
  let g: string | null = null;
  if (Math.abs(f - m) > 0.05) g = f > m ? "slightly female leaning" : "slightly male leaning";
  else if (Object.keys(gender).length) g = "evenly split by gender";
  return { bands, gender: g };
}

export function parseHeatmap(data: unknown): { lat: number; lng: number; v: number }[] {
  const d = obj(data);
  const r = obj(d.results);
  return arr(r.heatmap)
    .map((c) => {
      const o = obj(c);
      const loc = obj(o.location);
      const q = obj(o.query);
      return {
        lat: num(loc.latitude) ?? num(loc.lat) ?? 0,
        lng: num(loc.longitude) ?? num(loc.lon) ?? num(loc.lng) ?? 0,
        v: num(q.affinity) ?? num(q.popularity) ?? 0,
      };
    })
    .filter((c) => c.lat && c.lng);
}

export function resultCount(data: unknown): number {
  const d = obj(data);
  const r = obj(d.results);
  if (Array.isArray(d.results)) return d.results.length;
  for (const k of ["entities", "tags", "demographics", "heatmap"]) if (Array.isArray(r[k])) return (r[k] as unknown[]).length;
  return 0;
}

/** Strip bulky fields so cached responses stay small. */
export function trimResponse(data: unknown): unknown {
  const keepProps = ["address", "hours", "price_level", "website", "business_rating", "is_closed", "neighborhood", "geocode", "short_description"];
  const trimEntity = (e: Raw): Raw => {
    const props = obj(e.properties);
    const p: Raw = {};
    for (const k of keepProps) if (k in props) p[k] = props[k];
    return {
      entity_id: e.entity_id ?? e.id,
      name: e.name,
      type: e.type,
      subtype: e.subtype,
      types: e.types,
      location: e.location,
      properties: p,
      tags: arr(e.tags).slice(0, 25).map((t) => {
        const o = obj(t);
        return { tag_id: o.tag_id ?? o.id, name: o.name, type: o.type ?? o.subtype };
      }),
      query: e.query,
    };
  };
  const d = obj(data);
  if (Array.isArray(d.results)) return { ...d, results: (d.results as unknown[]).map((e) => trimEntity(obj(e))) };
  const r = obj(d.results);
  if (Array.isArray(r.entities)) return { ...d, results: { ...r, entities: r.entities.map((e) => trimEntity(obj(e))) } };
  return data;
}
