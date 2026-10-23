import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import { slugify } from "@/lib/util";
import { readinessScore } from "@/lib/readiness";
import {
  crossDomain,
  demographics,
  heatmap,
  searchTags,
  signalFor,
  tastePlaces,
  tasteTags,
} from "@/lib/qloo/endpoints";
import { distinctTags, tagKind, type RawPlace } from "@/lib/qloo/parse";
import { nameScore } from "@/lib/qloo/rank";
import { llmObject } from "@/lib/llm";
import { z } from "zod";
import {
  emptyFacts,
  type AgentCardDoc,
  type CardFacts,
  type Category,
  type Day,
  type Evidence,
  type Rival,
  type TagRef,
  type TasteProfile,
  type Venue,
} from "@/lib/types";

// ---------- Reads ----------

export const getVenue = (id: string) => db().get<Venue>(P.venue(id));

export async function getVenueBySlug(slug: string): Promise<Venue | null> {
  const s = await db().get<{ venueId: string }>(P.slug(slug));
  return s ? getVenue(s.venueId) : null;
}

export async function listOwnerVenues(uid: string): Promise<Venue[]> {
  const rows = await db().list<Venue>(P.venues(), { where: [["ownerId", "==", uid]] });
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function latestCard(venueId: string): Promise<AgentCardDoc | null> {
  const rows = await db().list<AgentCardDoc>(P.cards(venueId), { orderBy: ["version", "desc"], limit: 1 });
  return rows[0] ?? null;
}

export async function cardVersion(venueId: string, version: number): Promise<AgentCardDoc | null> {
  return db().get<AgentCardDoc>(P.card(venueId, version));
}

export const getProfile = (venueId: string) => db().get<TasteProfile>(P.taste(venueId));

export async function listRivals(venueId: string): Promise<Rival[]> {
  const rows = await db().list<Rival>(P.rivals(venueId));
  return rows.sort((a, b) => b.overlapScore - a.overlapScore);
}

// ---------- Helpers ----------

export function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/(jazz club|music venue|nightclub|club|concert|live music|dance)/.test(t)) return "music_venue";
  if (/(coffee|cafe|café|bakery|tea)/.test(t)) return "cafe";
  if (/(restaurant|izakaya|omakase|bistro|kitchen|trattoria|diner|taqueria|pizza|sushi)/.test(t)) return "restaurant";
  return "bar";
}

export const CATEGORY_LABEL: Record<Category, string> = {
  bar: "Bar",
  restaurant: "Restaurant",
  cafe: "Cafe",
  music_venue: "Music venue",
};

function priceBandFromLevel(level: number | null): CardFacts["priceBand"] {
  if (!level) return null;
  return (["$", "$", "$$", "$$$", "$$$$"][Math.max(0, Math.min(4, Math.round(level)))] ?? null) as CardFacts["priceBand"];
}

function hoursFromQloo(h: Record<string, string> | null): CardFacts["hours"] {
  if (!h) return null;
  const out: Partial<Record<Day, string>> = {};
  for (const [k, v] of Object.entries(h)) {
    if (["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(k)) out[k as Day] = v;
  }
  const days: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  for (const d of days) if (!out[d]) out[d] = "closed";
  return out as CardFacts["hours"];
}

/** Agent card facts built only from public Qloo data. Never invents anything. */
export function publicFacts(place: RawPlace | null, tags: TagRef[]): CardFacts {
  const f = emptyFacts();
  if (place) {
    f.address = place.address;
    f.hours = hoursFromQloo(place.hours);
    f.priceBand = priceBandFromLevel(place.priceLevel);
    f.booking = null;
  }
  f.tasteTags = [...new Set(tags.map((t) => t.name))].slice(0, 8);
  return f;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const exists = await db().get(P.slug(candidate));
    if (!exists) return candidate;
  }
  return `${slug}-${newId(5).toLowerCase()}`;
}

// ---------- Writes ----------

export async function saveCard(venueId: string, facts: CardFacts, voice: string, note?: string): Promise<AgentCardDoc> {
  const prev = await latestCard(venueId);
  const version = (prev?.version ?? 0) + 1;
  const readiness = readinessScore(facts, voice);
  const card: AgentCardDoc = { version, facts, voice, readiness, createdAt: Date.now(), note: note ?? "" };
  await db().set(P.card(venueId, version), { ...card });
  const v = await getVenue(venueId);
  await db().update(P.venue(venueId), {
    latestCardVersion: version,
    readiness,
    setupStep: Math.max(v?.setupStep ?? 1, readiness >= 60 ? 4 : v?.setupStep ?? 1),
  });
  return card;
}

interface CreateVenueInput {
  name: string;
  city: string;
  neighborhood?: string | null;
  category: Category;
  qlooEntityId?: string | null;
  descriptionTags?: string[];
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  isFictional?: boolean;
  isProxy?: boolean;
  qlooTags?: TagRef[];
  id?: string;
  slug?: string;
}

export async function createVenue(input: CreateVenueInput, facts: CardFacts, voice = ""): Promise<Venue> {
  const id = input.id ?? newId();
  const slugBase = input.slug ?? (input.isProxy ? `${input.name}` : input.name);
  const slug = input.slug ?? (await uniqueSlug(slugBase));
  const venue: Venue = {
    id,
    slug,
    name: input.name,
    city: input.city,
    neighborhood: input.neighborhood ?? null,
    category: input.category,
    qlooEntityId: input.qlooEntityId ?? null,
    ownerId: null,
    isClaimed: false,
    isFictional: !!input.isFictional,
    isProxy: !!input.isProxy,
    descriptionTags: input.descriptionTags ?? [],
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    address: input.address ?? null,
    qlooTags: input.qlooTags ?? [],
    latestCardVersion: 0,
    readiness: 0,
    latestRunId: null,
    latestSoav: null,
    setupStep: 1,
    ownerRole: null,
    createdAt: Date.now(),
  };
  await db().transaction(async (tx) => {
    const taken = await tx.get(P.slug(slug));
    if (taken) throw new Error("slug_taken");
    tx.set(P.slug(slug), { venueId: id });
    tx.set(P.venue(id), { ...venue });
  });
  await saveCard(id, facts, voice, "Created");
  return (await getVenue(id)) as Venue;
}

/** Find the venue for a Qloo place, or create it as an unclaimed proxy. */
export async function venueForPlace(place: RawPlace, city: string): Promise<Venue> {
  const existing = await db().list<Venue>(P.venues(), { where: [["qlooEntityId", "==", place.id]], limit: 1 });
  if (existing[0]) return existing[0];
  const tagText = place.tags.map((t) => t.name).join(" ");
  return createVenue(
    {
      name: place.name,
      city,
      neighborhood: place.neighborhood,
      category: guessCategory(`${tagText} ${place.name}`),
      qlooEntityId: place.id,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      isProxy: true,
      qlooTags: place.tags.slice(0, 12),
    },
    publicFacts(place, place.tags),
  );
}

/** Turn a free text description into Qloo tag ids, phrase by phrase. */
const STYLE_WORDS = new Set(["vibe", "vibes", "style", "aesthetic", "decor", "atmosphere", "ambience", "feel"]);

/** Spelling-insensitive key, so "Lo Fi Hip Hop" and "Lo-fi Hiphop" collapse into one tag. */
function tagSignature(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STYLE_WORDS.has(w))
    .join("");
}

const PickOut = z.object({ ids: z.array(z.string()) });

export async function describeToTags(description: string, venueId?: string) {
  const phrases = description
    .split(/[,.;\n]| and | with /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 8);
  const candidates = new Map<string, TagRef>();
  const heuristic: TagRef[] = [];
  const signatures = new Set<string>();
  const evidence: Evidence[] = [];
  const add = (list: TagRef[], t: TagRef) => {
    const sig = tagSignature(t.name);
    if (list.some((x) => x.id === t.id) || signatures.has(sig)) return;
    signatures.add(sig);
    list.push(t);
  };
  for (const phrase of phrases) {
    try {
      const r = await searchTags(phrase, { venueId }, 8);
      evidence.push(r.evidence);
      const scored = r.data
        .filter((t) => tagKind(t) !== "noise")
        .map((t, i) => ({ t, s: nameScore(phrase, t.name), i }))
        .sort((a, b) => b.s - a.s || a.i - b.i);
      for (const { t } of scored) candidates.set(t.id, t);
      // Heuristic pick: tags whose name matches the phrase, else the single best loose match.
      const strong = scored.filter((x) => x.s >= 0.5);
      for (const { t } of (strong.length ? strong : scored.slice(0, 1)).slice(0, 2)) add(heuristic, t);
    } catch {
      // Skip phrases Qloo cannot map.
    }
  }

  // Qloo tag search is literal: "vinyl" also returns "Vinyl Flooring". Let the fast model keep only the
  // candidates that describe this kind of venue. It can only choose from real Qloo tag ids.
  const pick = await llmObject({
    tier: "fast",
    schema: PickOut,
    cache: true,
    temperature: 0,
    system:
      "You map a venue description to taste tags. From the candidate Qloo tags, return the ids of up to 12 that describe this venue, its drinks, food, music or crowd. Drop tags about unrelated products or shops (for example flooring or signage). Only return ids from the list.",
    prompt: JSON.stringify({ description, candidates: [...candidates.values()].map((t) => ({ id: t.id, name: t.name })) }),
  });
  if (pick?.ids.length) {
    signatures.clear();
    const chosen: TagRef[] = [];
    for (const id of pick.ids) {
      const t = candidates.get(id);
      if (t) add(chosen, t);
    }
    if (chosen.length >= 4) return { tags: chosen.slice(0, 12), evidence };
  }
  return { tags: heuristic.slice(0, 12), evidence };
}

export async function claimVenue(venueId: string, uid: string, role: string): Promise<"ok" | "already_claimed" | "not_found"> {
  return db().transaction(async (tx) => {
    const v = await tx.get<Venue>(P.venue(venueId));
    if (!v) return "not_found";
    if (v.ownerId && v.ownerId !== uid) return "already_claimed";
    tx.update(P.venue(venueId), {
      ownerId: uid,
      isClaimed: true,
      isProxy: false,
      ownerRole: role,
      setupStep: Math.max(2, v.setupStep),
    });
    return "ok";
  });
}

// ---------- Taste DNA ----------


export async function buildProfile(venueId: string): Promise<TasteProfile> {
  const venue = await getVenue(venueId);
  if (!venue) throw new Error("not_found");
  const sig = signalFor(venue);
  if (!sig.entities?.length && !sig.tags?.length) throw new Error("This venue has no Qloo signal yet. Describe it or link a Qloo place.");
  const ctx = { venueId };
  const location = [venue.neighborhood, venue.city].filter(Boolean).join(", ") || venue.city;

  const settled = await Promise.allSettled([
    tasteTags(sig, ctx, 30),
    demographics(sig, ctx),
    crossDomain(sig, "artist", ctx, 6),
    crossDomain(sig, "movie", ctx, 6),
    crossDomain(sig, "brand", ctx, 6),
    heatmap(sig, location, ctx),
  ]);
  const ok = <T,>(i: number) => (settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<T>).value : null);
  const tagsR = ok<Awaited<ReturnType<typeof tasteTags>>>(0);
  const demoR = ok<Awaited<ReturnType<typeof demographics>>>(1);
  const artR = ok<Awaited<ReturnType<typeof crossDomain>>>(2);
  const filmR = ok<Awaited<ReturnType<typeof crossDomain>>>(3);
  const brandR = ok<Awaited<ReturnType<typeof crossDomain>>>(4);
  const heatR = ok<Awaited<ReturnType<typeof heatmap>>>(5);
  if (!tagsR) {
    const reason = settled[0].status === "rejected" ? (settled[0] as PromiseRejectedResult).reason : null;
    throw new Error(`Qloo taste tags failed: ${(reason as Error)?.message ?? "unknown"}`);
  }

  const allTags = tagsR.data;
  const card = await latestCard(venueId);
  // A described venue has no Qloo place behind it, so the owner's own mapped tags lead the cloud.
  // They are real Qloo tags (from /v2/tags), shown first, then Qloo's related insight tags.
  const ownTags: TagRef[] = venue.qlooEntityId
    ? []
    : (card?.facts.tasteTags ?? []).map((name, i) => ({ id: venue.descriptionTags[i] ?? `own:${name}`, name, affinity: 1 }));
  const dishes = allTags.filter((t) => tagKind(t) === "dining");
  const dining = dishes.slice(0, 3).map((t) => ({ id: t.id, name: t.name, type: "dining", affinity: t.affinity }));
  const nonDish = allTags.filter((t) => tagKind(t) !== "dining");
  const tasteOnly = nonDish.length >= 8 ? nonDish : [...nonDish, ...dishes];

  // Hot neighbourhoods from the heatmap: top cells, named by nearest known rival or the city.
  const cells = heatR?.data ?? [];
  const profile: TasteProfile = {
    tags: distinctTags([...ownTags, ...nonDish, ...dishes]).slice(0, 20),
    demographics: demoR?.data.bands ?? [],
    genderSkew: demoR?.data.gender ?? null,
    affinities: {
      artists: (artR?.data ?? []).slice(0, 5),
      films: (filmR?.data ?? []).slice(0, 5),
      brands: (brandR?.data ?? []).slice(0, 5),
      dining,
    },
    heatmap: cells.slice(0, 400),
    hot: [],
    evidence: {
      tags: tagsR.evidence,
      demographics: demoR?.evidence ?? null,
      artists: artR?.evidence ?? null,
      films: filmR?.evidence ?? null,
      brands: brandR?.evidence ?? null,
      heatmap: heatR?.evidence ?? null,
    },
    callCount: settled.filter((s) => s.status === "fulfilled").length,
    computedAt: Date.now(),
  };
  await db().set(P.taste(venueId), { ...profile });

  const update: Record<string, unknown> = {
    // Every venue is represented the same way: its top Qloo insight tags.
    qlooTags: tasteOnly.slice(0, 20),
    setupStep: Math.max(3, venue.setupStep),
  };
  await db().update(P.venue(venueId), update);
  if (card && card.facts.tasteTags.length === 0) {
    await saveCard(venueId, { ...card.facts, tasteTags: distinctTags(tasteOnly).map((t) => t.name).slice(0, 8) }, card.voice, "Added Qloo taste tags");
  }
  return profile;
}

/** Make sure a venue has Qloo taste tags in the same tag space the arena scores against. */
export async function ensureVenueTags(venue: Venue): Promise<TagRef[]> {
  if (venue.qlooTags.length >= 10 && venue.qlooTags.some((t) => t.affinity !== undefined)) return venue.qlooTags;
  const sig = signalFor(venue);
  if (!sig.entities?.length && !sig.tags?.length) return venue.qlooTags;
  try {
    const r = await tasteTags(sig, { venueId: venue.id }, 20);
    if (r.data.length) {
      await db().update(P.venue(venue.id), { qlooTags: r.data });
      return r.data;
    }
  } catch {
    // Keep whatever tags the venue already has.
  }
  return venue.qlooTags;
}

// ---------- Rivals ----------

export async function findRivals(venueId: string, take = 8): Promise<Rival[]> {
  const venue = await getVenue(venueId);
  if (!venue) throw new Error("not_found");
  const sig = signalFor(venue);
  const location = [venue.neighborhood, venue.city].filter(Boolean).join(", ") || venue.city;
  let r = await tastePlaces(sig, location, { exclude: venue.qlooEntityId ? [venue.qlooEntityId] : [], take: take + 4 }, { venueId });
  if (r.data.length < 3 && venue.neighborhood) {
    r = await tastePlaces(sig, venue.city, { exclude: venue.qlooEntityId ? [venue.qlooEntityId] : [], take: take + 4 }, { venueId });
  }
  const myTagNames = new Set(venue.qlooTags.map((t) => t.name.toLowerCase()));
  // Qloo place results can include shops (an instrument store, a boutique). Agents compare bars and restaurants,
  // so retail and services are left out of the rival set.
  const RETAIL_RE = /\b(store|shop|instruments?|boutique|salon|spa|pharmacy|bank|gallery|museum|gym|fitness|school|clinic|supermarket|grocery|apartments?|realty|dentist)\b/i;
  const places = r.data
    .filter((p) => p.id !== venue.qlooEntityId && !p.isClosed && !RETAIL_RE.test(p.name) && !p.tags.some((t) => /retail|shopping/i.test(`${t.name} ${t.type ?? ""}`)))
    .slice(0, take);
  await db().deleteCollection(P.rivals(venueId));
  const rivals: Rival[] = [];
  for (const place of places) {
    const rv = await venueForPlace(place, venue.city);
    const tags = await ensureVenueTags(rv);
    const rival: Rival = {
      id: rv.id,
      name: rv.name,
      slug: rv.slug,
      overlapScore: Math.round((place.affinity ?? 0.5) * 100) / 100,
      lat: rv.lat,
      lng: rv.lng,
      address: rv.address,
      sharedTags: tags.filter((t) => myTagNames.has(t.name.toLowerCase())).slice(0, 4).map((t) => t.name),
      evidence: r.evidence,
    };
    rivals.push(rival);
    await db().set(P.rival(venueId, rv.id), { ...rival });
  }
  return rivals.sort((a, b) => b.overlapScore - a.overlapScore);
}

// ---------- Deletion ----------

export async function releaseVenue(venueId: string) {
  await db().update(P.venue(venueId), { ownerId: null, isClaimed: false, ownerRole: null });
}
