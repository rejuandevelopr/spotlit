// Public concierge: the consumer side. Resolves tastes with Qloo, scores venues the same way
// the arena does, asks the top venue agents over A2A and recommends one.
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { env } from "@/lib/env";
import { searchEntities, scoreCandidates, tastePlaces, tasteTags, searchTags } from "@/lib/qloo/endpoints";
import { askVenue } from "@/lib/a2a/client";
import { nameScore } from "@/lib/qloo/rank";
import type { A2AMeta } from "@/lib/a2a/server";
import { combineAffinity, constraintFit, heuristicQuality, score, tagOverlap, WEIGHTS } from "@/lib/arena/scoring";
import { ensureVenueTags, latestCard, venueForPlace } from "@/lib/venues";
import { venueText } from "./venue";
import { parseIntent, type Intent } from "./intent";
import type { EntityRef, Evidence, Venue, VenueReply } from "@/lib/types";

export interface ConciergeQuery {
  text?: string;
  city?: string | null;
  likes?: string[];
  occasion?: string | null;
  budget?: Intent["budget"];
  day?: Intent["day"];
  time?: string | null;
  partySize?: number | null;
}

export interface Consulted {
  venueId: string;
  name: string;
  slug: string;
  isProxy: boolean;
  isFictional: boolean;
  A: number;
  C: number;
  Q: number;
  score: number;
  reply: VenueReply | null;
}

export interface ConciergeResult {
  intent: Intent;
  resolvedLikes: EntityRef[];
  resolvedTags: { id: string; name: string }[];
  recommendation: Consulted | null;
  consulted: Consulted[];
  reason: string;
  weights: typeof WEIGHTS;
  evidence: Evidence[];
  message: string;
}

const RETAIL_TAG = /\b(shop|store|flooring|sign|signs|supply|supplies|repair|rental|wholesale|printing|manufactur\w*|installation|contractor)\b/i;

// Words that describe a place, a drink or a mood rather than an artist, film or brand.
const VENUE_WORDS =
  /\b(vinyl|records?|hi ?fi|listening|bar|pub|wine|natural|cocktails?|beer|craft|sake|mezcal|tequila|whisk(e)?y|coffee|tea|dim|candle\w*|cozy|cosy|quiet|loud|rooftop|patio|garden|jazz club|live music|dj|dance|karaoke|tacos?|pizza|ramen|sushi|tapas|oysters?|brunch|small plates|late night|speakeasy|dive|lounge|neon|intimate|romantic)\b/i;

/** Same words both ways, so "Williamsburg" does not resolve to "Williamsburg Quartet". */
function sameName(a: string, b: string) {
  return nameScore(a, b) >= 1 && nameScore(b, a) >= 1;
}

/** True when a "like" is really a place, such as the neighbourhood the person asked for. */
function isPlaceLike(like: string, placeWords: string) {
  const l = like.toLowerCase();
  return l.length > 2 && (placeWords.includes(l) || /\b(brooklyn|manhattan|williamsburg|bushwick|greenpoint|queens|soho|tribeca|harlem|chelsea|west village|east village|lower east side)\b/i.test(l));
}

const NYC_RE =
  /\b(new york|nyc|ny|brooklyn|manhattan|queens|bronx|staten island|williamsburg|greenpoint|bushwick|soho|tribeca|harlem|chelsea|west village|east village|lower east side|dumbo|astoria)\b/i;

/**
 * Venues are stored under a plain city name ("New York"). Agents send many forms:
 * "New York, NY", "Williamsburg, Brooklyn", "NYC". Map them all to the stored name.
 */
export function normalizeCity(raw: string | null | undefined): string {
  const c = (raw ?? "").trim();
  if (!c) return env.demoCity;
  if (NYC_RE.test(c)) return "New York";
  const first = c.split(",")[0].trim();
  return first.replace(/\b\w/g, (m) => m.toUpperCase());
}

export async function runConcierge(q: ConciergeQuery, meta: A2AMeta): Promise<ConciergeResult> {
  const parsed = parseIntent(q.text ?? "");
  const intent: Intent = {
    day: q.day ?? parsed.day,
    time: q.time ?? parsed.time,
    partySize: q.partySize ?? parsed.partySize,
    budget: q.budget ?? parsed.budget,
    occasion: q.occasion ?? parsed.occasion,
    likes: (q.likes?.length ? q.likes : parsed.likes).slice(0, 4),
    city: q.city ?? parsed.city ?? env.demoCity,
  };
  const city = normalizeCity(intent.city);
  const evidence: Evidence[] = [];

  // 1. Resolve tastes. Venue words ("vinyl", "natural wine", "dim listening bar") become Qloo tags.
  // Names ("Japanese Breakfast") become Qloo entities only on an exact name match. Place names are skipped.
  const resolved: EntityRef[] = [];
  const resolvedTags: { id: string; name: string }[] = [];
  const vibePhrases: string[] = [];
  let tagSignal: string[] = [];
  const placeWords = `${q.city ?? ""} ${intent.city ?? ""} ${city}`.toLowerCase();
  for (const raw of intent.likes) {
    const like = raw.trim();
    if (!like || isPlaceLike(like, placeWords)) continue;
    const asTag = async () => {
      try {
        const t = await searchTags(like, {}, 8);
        evidence.push(t.evidence);
        // Skip shop and trade tags ("Vinyl sign shop", "Vinyl Flooring") and prefer the closest name.
        const pool = t.data.filter((x) => !RETAIL_TAG.test(x.name));
        const extra = (x: { name: string }) => x.name.split(/[^a-zA-Z0-9]+/).filter(Boolean).length;
        const strong = pool.filter((x) => nameScore(like, x.name) >= 1).sort((a, b) => extra(a) - extra(b));
        const best = strong[0] ?? pool.find((x) => nameScore(like, x.name) >= 0.5) ?? null;
        if (best) {
          vibePhrases.push(like);
          tagSignal.push(best.id);
          resolvedTags.push({ id: best.id, name: best.name });
          return true;
        }
      } catch {
        // Ignore and try the other route.
      }
      return false;
    };
    const asEntity = async () => {
      try {
        const r = await searchEntities(like, ["urn:entity:artist", "urn:entity:movie", "urn:entity:brand", "urn:entity:tv_show"], {}, 3);
        evidence.push(r.evidence);
        const hit = r.data.find((e) => sameName(like, e.name));
        if (hit) {
          resolved.push({ ...hit, type: hit.type.replace("urn:entity:", "") });
          return true;
        }
      } catch {
        // Ignore and try the other route.
      }
      return false;
    };
    if (VENUE_WORDS.test(like)) {
      if (!(await asTag())) await asEntity();
    } else if (!(await asEntity())) {
      await asTag();
    }
  }
  tagSignal = [...new Set(tagSignal)].slice(0, 6);
  if (!resolved.length && !tagSignal.length) {
    const words = [intent.occasion, ...(q.text ?? "").split(/[,.]/)].filter(Boolean).slice(0, 3) as string[];
    for (const w of words) {
      try {
        const r = await searchTags(w, {}, 2);
        tagSignal.push(...r.data.map((t) => t.id));
      } catch {
        /* ignore */
      }
    }
    tagSignal = [...new Set(tagSignal)].slice(0, 4);
  }
  const signal = { entities: resolved.length ? resolved.map((r) => r.id) : undefined, tags: tagSignal.length ? tagSignal : undefined };

  // 2. Candidates: venues Spotlit knows in the city, topped up with Qloo taste matches.
  // Claimed venues and venues in the neighbourhood the person named always make the list; others fill up to 60.
  const wanted = `${q.city ?? ""} ${q.text ?? ""}`.toLowerCase();
  const inArea = (v: Venue) => !!v.neighborhood && wanted.includes(v.neighborhood.toLowerCase());
  const all = (await db().list<Venue>(P.venues(), { where: [["city", "==", city]], limit: 400 })).filter((v) => v.latestCardVersion > 0);
  const first = all.filter((v) => v.isClaimed || inArea(v));
  let venues = [...first, ...all.filter((v) => !first.includes(v))].slice(0, Math.max(60, first.length));
  if (venues.length < 4 && (signal.entities?.length || signal.tags?.length)) {
    try {
      const r = await tastePlaces(signal, city, { take: 6 });
      evidence.push(r.evidence);
      for (const p of r.data) venues.push(await venueForPlace(p, city));
    } catch {
      /* ignore */
    }
  }
  venues = [...new Map(venues.map((v) => [v.id, v])).values()];
  if (!venues.length) {
    return { intent, resolvedLikes: resolved, resolvedTags, recommendation: null, consulted: [], reason: "", weights: WEIGHTS, evidence, message: `I could not find venues in ${city} yet.` };
  }

  // 3. Taste scores from Qloo, same method as the arena.
  const personaAff = new Map<string, number>();
  if (signal.entities?.length || signal.tags?.length) {
    try {
      const r = await tasteTags(signal, {}, 50);
      evidence.push(r.evidence);
      r.data.forEach((t, i) => {
        const a = t.affinity ?? 1 - i / Math.max(1, r.data.length);
        personaAff.set(t.id, a);
        personaAff.set(t.name.toLowerCase(), a);
      });
    } catch {
      /* ignore */
    }
  }
  // The tags the person asked for count fully, even if Qloo's related list leaves them out or the call failed.
  for (const t of resolvedTags) {
    personaAff.set(t.id, 1);
    personaAff.set(t.name.toLowerCase(), 1);
  }
  for (const v of venues) v.qlooTags = await ensureVenueTags(v);
  let entityAff: Record<string, number> = {};
  if (signal.entities?.length) {
    try {
      const ids = venues.map((v) => v.qlooEntityId).filter(Boolean) as string[];
      const r = await scoreCandidates(signal.entities, ids.slice(0, 25));
      evidence.push(r.evidence);
      entityAff = r.data;
    } catch {
      /* ignore */
    }
  }
  // A venue's own description tags (what the owner said it is) count alongside its Qloo insight tags.
  const tagScores = venues.map((v) => {
    const own = (v.descriptionTags ?? []).filter((id) => !v.qlooTags.some((t) => t.id === id)).map((id) => ({ id, name: id, affinity: 1 }));
    return tagOverlap([...own, ...v.qlooTags], personaAff);
  });
  const ent = venues.map((v) => (v.qlooEntityId ? (entityAff[v.qlooEntityId] ?? 0) : null));
  const base = combineAffinity(tagScores, ent);
  // Direct credit when a venue's own Qloo tags name what the person asked for ("natural wine" and "Natural Wine Bar").
  const askedFit = (v: Venue) => {
    if (!vibePhrases.length) return 0;
    const ids = new Set([...v.qlooTags.map((t) => t.id), ...(v.descriptionTags ?? [])]);
    const idHit = resolvedTags.filter((t) => ids.has(t.id)).length;
    const nameHit = vibePhrases.filter((ph) => v.qlooTags.some((t) => nameScore(ph, t.name) >= 0.6)).length;
    return Math.min(1, Math.max(idHit, nameHit) / vibePhrases.length);
  };
  const A = base.map((a, i) => (vibePhrases.length ? Math.min(1, 0.6 * a + 0.4 * askedFit(venues[i])) : a));

  // 4. Ask the top four venue agents over A2A.
  // When the request names a neighbourhood, venues there are asked first.
  const ranked = venues
    .map((v, i) => ({ v, A: A[i], near: inArea(v) }))
    .sort((a, b) => Number(b.near) - Number(a.near) || b.A - a.A);
  // A claimed venue has a real agent, so the best matching claimed venue nearby is always asked.
  const claimedNear = ranked.find((x) => x.v.isClaimed && (x.near || !wanted.trim()));
  const top = ranked.slice(0, 4);
  if (claimedNear && !top.includes(claimedNear)) top[top.length - 1] = claimedNear;
  const likesText = resolved.map((r) => r.name);
  const consulted: (Consulted & { inboxId?: string })[] = await Promise.all(
    top.map(async ({ v, A: a }) => {
      const ex = await askVenue(
        v.slug,
        {
          text: q.text || `Looking for ${intent.occasion ?? "a night out"} in ${city}${likesText.length ? `, we love ${likesText.join(" and ")}` : ""}.`,
          constraints: { day: intent.day, time: intent.time, partySize: intent.partySize, budget: intent.budget, occasion: intent.occasion, likes: likesText },
        },
        { meta },
      );
      const card = await latestCard(v.id);
      const C = ex.reply
        ? constraintFit(ex.reply, { partySize: intent.partySize ?? 2, partyMax: card?.facts.partyMax ?? null, occasion: intent.occasion ?? "after work", venueText: card ? venueText(v, card) : v.name })
        : 0;
      const Q = ex.reply ? heuristicQuality(ex.reply, likesText) : 0;
      return {
        venueId: v.id,
        name: v.name,
        slug: v.slug,
        isProxy: v.isProxy && !v.isClaimed,
        isFictional: v.isFictional,
        A: Math.round(a * 100) / 100,
        C: Math.round(C * 100) / 100,
        Q: Math.round(Q * 100) / 100,
        score: Math.round(score(a, C, Q) * 100) / 100,
        reply: ex.reply,
        inboxId: ex.inboxId,
      };
    }),
  );
  consulted.sort((a, b) => b.score - a.score);
  const rec = consulted[0] ?? null;

  // Mark outcomes in each venue's inbox: recommended, top 3, or lost.
  await Promise.all(
    consulted.map((c, i) =>
      c.inboxId
        ? db().update(P.inboxItem(c.venueId, c.inboxId), { outcome: i === 0 ? "recommended" : i < 3 ? "top3" : "lost" }).catch(() => undefined)
        : Promise.resolve(),
    ),
  );

  const reason = rec
    ? `${rec.name} scored ${rec.score.toFixed(2)}: taste match ${rec.A.toFixed(2)}, fit ${rec.C.toFixed(2)}, answer ${rec.Q.toFixed(2)}.${rec.reply?.availability === "unknown" ? " Its hours are not listed, so check before you go." : ""}`
    : "";
  const message = rec
    ? `Try ${rec.name}. ${rec.reply?.pitch ?? ""}`.trim()
    : "No venue agent could answer that request.";
  return {
    intent,
    resolvedLikes: resolved,
    resolvedTags,
    recommendation: rec,
    consulted: consulted.map(({ inboxId: _i, ...c }) => c),
    reason,
    weights: WEIGHTS,
    evidence,
    message,
  };
}
