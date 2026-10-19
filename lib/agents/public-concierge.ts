// Public concierge: the consumer side. Resolves tastes with Qloo, scores venues the same way
// the arena does, asks the top venue agents over A2A and recommends one.
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { env } from "@/lib/env";
import { searchEntities, scoreCandidates, tastePlaces, tasteTags, searchTags } from "@/lib/qloo/endpoints";
import { askVenue } from "@/lib/a2a/client";
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
  recommendation: Consulted | null;
  consulted: Consulted[];
  reason: string;
  weights: typeof WEIGHTS;
  evidence: Evidence[];
  message: string;
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
  const city = intent.city && /brooklyn|williamsburg|greenpoint|bushwick|manhattan|nyc/i.test(intent.city) ? "New York" : intent.city ?? env.demoCity;
  const evidence: Evidence[] = [];

  // 1. Resolve tastes to Qloo entities (or tags when nothing matches).
  const resolved: EntityRef[] = [];
  for (const like of intent.likes) {
    try {
      const r = await searchEntities(like, ["urn:entity:artist", "urn:entity:movie", "urn:entity:brand", "urn:entity:tv_show"], {}, 1);
      evidence.push(r.evidence);
      if (r.data[0]) resolved.push({ ...r.data[0], type: r.data[0].type.replace("urn:entity:", "") });
    } catch {
      // Unresolved likes are simply skipped.
    }
  }
  let tagSignal: string[] = [];
  if (!resolved.length) {
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
  const signal = resolved.length ? { entities: resolved.map((r) => r.id) } : { tags: tagSignal };

  // 2. Candidates: venues Spotlit knows in the city, topped up with Qloo taste matches.
  let venues = (await db().list<Venue>(P.venues(), { where: [["city", "==", city]], limit: 60 })).filter((v) => v.latestCardVersion > 0);
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
    return { intent, resolvedLikes: resolved, recommendation: null, consulted: [], reason: "", weights: WEIGHTS, evidence, message: `I could not find venues in ${city} yet.` };
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
  const tagScores = venues.map((v) => tagOverlap(v.qlooTags, personaAff));
  const ent = venues.map((v) => (v.qlooEntityId ? (entityAff[v.qlooEntityId] ?? 0) : null));
  const A = combineAffinity(tagScores, ent);

  // 4. Ask the top four venue agents over A2A.
  const top = venues
    .map((v, i) => ({ v, A: A[i] }))
    .sort((a, b) => b.A - a.A)
    .slice(0, 4);
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
    recommendation: rec,
    consulted: consulted.map(({ inboxId: _i, ...c }) => c),
    reason,
    weights: WEIGHTS,
    evidence,
    message,
  };
}
