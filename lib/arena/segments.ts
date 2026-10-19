// Taste segments for a city, built from Qloo city tags mapped onto going out archetypes.
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { slugify } from "@/lib/util";
import { cityTags, crossDomain, searchTags } from "@/lib/qloo/endpoints";
import type { Category, EntityRef, Evidence, Segment, TagRef } from "@/lib/types";

interface Archetype { id: string; name: string; keywords: string[]; search: string; occasions: string[] }

export const ARCHETYPES: Archetype[] = [
  { id: "vinyl", name: "Vinyl diggers", keywords: ["vinyl", "record", "hi fi", "hi-fi", "listening", "city pop", "psych", "ambient", "soul"], search: "vinyl", occasions: ["solo drink", "date night", "after work"] },
  { id: "wine", name: "Natural wine crowd", keywords: ["natural wine", "orange wine", "wine bar", "wine", "low abv", "small plates"], search: "natural wine", occasions: ["date night", "after work", "group dinner"] },
  { id: "date", name: "Indie date night", keywords: ["date", "romantic", "dim", "cozy", "indie", "intimate"], search: "date night", occasions: ["date night"] },
  { id: "jazz", name: "Jazz after work", keywords: ["jazz", "blues", "live music", "neo soul"], search: "jazz", occasions: ["after work", "live music"] },
  { id: "dj", name: "Late night DJ", keywords: ["dj", "house", "techno", "dance", "late night", "hip hop", "electronic", "club"], search: "dj", occasions: ["late night", "live music"] },
  { id: "brunch", name: "Brunch groups", keywords: ["brunch", "mimosa", "outdoor", "group", "coffee", "bakery"], search: "brunch", occasions: ["brunch", "group dinner"] },
  { id: "cocktail", name: "Cocktail hunters", keywords: ["cocktail", "speakeasy", "mixology", "craft cocktails"], search: "craft cocktails", occasions: ["date night", "after work"] },
  { id: "foodie", name: "Foodie explorers", keywords: ["izakaya", "omakase", "tasting", "chef", "small plates", "cuisine"], search: "tasting menu", occasions: ["group dinner", "date night"] },
];

const BY_CATEGORY: Record<Category, string[]> = {
  bar: ["vinyl", "wine", "date", "jazz", "dj", "brunch"],
  music_venue: ["vinyl", "jazz", "dj", "date", "wine", "cocktail"],
  restaurant: ["foodie", "date", "wine", "brunch", "cocktail", "jazz"],
  cafe: ["brunch", "vinyl", "wine", "foodie", "date", "jazz"],
};

export function segmentKey(city: string, category: Category) {
  return `${slugify(city)}__${category}`;
}

function matchTags(tags: TagRef[], a: Archetype): TagRef[] {
  return tags.filter((t) => a.keywords.some((k) => t.name.toLowerCase().includes(k)));
}

export async function buildSegments(city: string, category: Category, force = false): Promise<Segment[]> {
  const key = segmentKey(city, category);
  if (!force) {
    const cached = await db().get<{ segments: Segment[]; builtAt: number }>(P.segment(key));
    if (cached?.segments?.length) return cached.segments;
  }

  let cityList: TagRef[] = [];
  let cityEvidence: Evidence | null = null;
  try {
    const r = await cityTags(city, {}, 60);
    cityList = r.data;
    cityEvidence = r.evidence;
  } catch {
    cityList = [];
  }

  const ids = BY_CATEGORY[category] ?? BY_CATEGORY.bar;
  const segments: Segment[] = [];
  for (const id of ids) {
    const a = ARCHETYPES.find((x) => x.id === id);
    if (!a) continue;
    let tags = matchTags(cityList, a).slice(0, 4);
    let evidence = cityEvidence;
    let weight = tags.reduce((s, t) => s + (t.affinity ?? 0.5), 0);
    if (!tags.length) {
      // The city list did not include this archetype: ask Qloo for the tag directly.
      try {
        const r = await searchTags(a.search, {}, 4);
        tags = r.data.slice(0, 3);
        evidence = r.evidence;
        weight = 0.5;
      } catch {
        tags = [];
      }
    }
    if (!tags.length) continue;

    const signal = { tags: tags.map((t) => t.id) };
    const pool: EntityRef[] = [];
    for (const [type, take] of [["artist", 8], ["movie", 5], ["brand", 5]] as const) {
      try {
        const r = await crossDomain(signal, type, {}, take);
        pool.push(...r.data);
      } catch {
        // A missing domain just means fewer seed options.
      }
    }
    if (!pool.length) continue;
    segments.push({
      id: a.id,
      name: a.name,
      tagIds: tags.map((t) => t.id),
      tagNames: tags.map((t) => t.name),
      weight,
      occasions: a.occasions,
      seedPool: pool,
      evidence,
    });
  }
  const total = segments.reduce((s, x) => s + x.weight, 0) || 1;
  // Keep the weights gentle so every segment gets a fair number of personas.
  for (const s of segments) s.weight = Math.round((0.5 * (s.weight / total) + 0.5 / segments.length) * 1000) / 1000;
  if (segments.length) await db().set(P.segment(key), { city, category, segments, builtAt: Date.now() });
  return segments;
}
