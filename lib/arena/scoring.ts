// Pure scoring code for the Agent Arena. No I/O, fully unit tested.
import type { CandidateResult, Category, Day, ReasonCode, RoundDoc, RunSummary, Segment, VenueReply } from "@/lib/types";

/** Qloo taste decides 60% of every verdict. Shown openly in the report. */
export const WEIGHTS = { A: 0.6, C: 0.25, Q: 0.15 } as const;

export const TASTE_GAP_THRESHOLD = 0.15;
export const PITCH_GAP_THRESHOLD = 0.2;

export function minMax(values: number[]): number[] {
  if (!values.length) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi - lo < 1e-9) return values.map(() => 0.5);
  return values.map((v) => (v - lo) / (hi - lo));
}

export function score(normA: number, C: number, Q: number) {
  return WEIGHTS.A * normA + WEIGHTS.C * C + WEIGHTS.Q * Q;
}

/**
 * Taste match between a venue and a persona: cosine similarity between the venue's Qloo tag
 * affinities and the persona's Qloo tag affinities (tags missing on either side count as 0).
 * Venue tags without an affinity value are weighted by rank. Result is 0..1.
 */
export function tagOverlap(
  venueTags: { id: string; name: string; affinity?: number }[],
  personaAff: Map<string, number>,
): number {
  if (!venueTags.length || !personaAff.size) return 0;
  let dotp = 0;
  let vv = 0;
  venueTags.slice(0, 20).forEach((t, i) => {
    const w = t.affinity ?? 1 / (1 + i * 0.15);
    const a = personaAff.get(t.id) ?? personaAff.get(t.name.toLowerCase()) ?? 0;
    dotp += w * a;
    vv += w * w;
  });
  // personaAff stores each tag under two keys (id and name), so count unique values once.
  const seen = new Set<string>();
  let pp = 0;
  for (const [k, a] of personaAff) {
    if (k.startsWith("urn:") || !seen.has(k)) {
      if (k.startsWith("urn:")) pp += a * a;
      seen.add(k);
    }
  }
  if (pp === 0) for (const a of personaAff.values()) pp += (a * a) / 2;
  return vv && pp ? dotp / Math.sqrt(vv * pp) : 0;
}

/**
 * Combine Qloo signals into one affinity per candidate. When every candidate has a Qloo
 * entity, A is the mean of the normalised tag match and the normalised Qloo place affinity.
 * If any candidate has no Qloo entity (a described or fictional venue), every candidate is
 * scored on tag match only, so all candidates are always judged the same way.
 */
export function combineAffinity(tag: number[], entity: (number | null)[]): number[] {
  const nTag = minMax(tag);
  if (entity.length < 2 || entity.some((e) => e === null)) return nTag;
  const nEnt = minMax(entity as number[]);
  return tag.map((_, i) => 0.5 * nTag[i] + 0.5 * nEnt[i]);
}

// ---------- Constraint fit ----------

export function parseRange(r: string): [number, number] | null {
  const m = r.match(/(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2] ?? 0);
  let b = Number(m[3]) * 60 + Number(m[4] ?? 0);
  if (b <= a) b += 24 * 60; // closes after midnight
  return [a, b];
}

const DAY_ORDER: Day[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function availabilityAt(hours: Record<string, string> | null, day: Day, time: string): VenueReply["availability"] {
  if (!hours) return "unknown";
  const [hh, mm] = time.split(":").map(Number);
  const t = hh * 60 + (mm || 0);
  const check = (d: Day, minutes: number) => {
    const v = hours[d];
    if (v === undefined || v === "") return "unknown" as const;
    if (v.toLowerCase() === "closed") return "closed" as const;
    const r = parseRange(v);
    if (!r) return "unknown" as const;
    return minutes >= r[0] && minutes < r[1] ? ("open" as const) : ("closed" as const);
  };
  const today = check(day, t);
  if (today === "open") return "open";
  // A late slot may fall inside yesterday's after midnight hours.
  const prev = DAY_ORDER[(DAY_ORDER.indexOf(day) + 6) % 7];
  if (t < 6 * 60 && check(prev, t + 24 * 60) === "open") return "open";
  return today;
}

export function priceFit(band: string | null, budget: string | null): VenueReply["priceFit"] {
  if (!band || !budget) return "unknown";
  return band.length <= budget.length ? "yes" : "no";
}

const OCCASION_WORDS: Record<string, string[]> = {
  "date night": ["date", "romantic", "dim", "cozy", "intimate", "candle", "wine", "listening"],
  "group dinner": ["group", "share", "plates", "table", "family", "dinner"],
  "solo drink": ["bar", "counter", "listening", "wine", "quiet", "vinyl"],
  "live music": ["live", "jazz", "band", "dj", "music", "set", "vinyl"],
  "after work": ["happy hour", "after work", "wine", "bar", "cocktail", "drink"],
  brunch: ["brunch", "coffee", "mimosa", "pastry", "eggs", "daytime"],
  "late night": ["late", "dj", "dance", "night"],
};

export function occasionFit(occasion: string, text: string): number {
  const words = OCCASION_WORDS[occasion] ?? [];
  const t = text.toLowerCase();
  const hits = words.filter((w) => t.includes(w)).length;
  return hits >= 2 ? 1 : hits === 1 ? 0.8 : 0.55;
}

export function constraintFit(
  reply: VenueReply,
  opts: { partySize: number; partyMax: number | null; occasion: string; venueText: string },
): number {
  const avail = reply.availability === "open" ? 1 : reply.availability === "unknown" ? 0.45 : 0;
  const price = reply.priceFit === "yes" ? 1 : reply.priceFit === "unknown" ? 0.6 : 0.15;
  const party = opts.partyMax == null ? 0.7 : opts.partySize <= opts.partyMax ? 1 : 0;
  const occ = occasionFit(opts.occasion, opts.venueText);
  let c = 0.4 * avail + 0.25 * price + 0.15 * party + 0.2 * occ;
  if (reply.availability === "closed") c *= 0.25;
  return Math.max(0, Math.min(1, c));
}

/** Heuristic answer quality, used when no LLM is configured and to sanity check LLM ratings. */
export function heuristicQuality(reply: VenueReply, likes: string[]): number {
  let q = 0.25;
  const p = reply.pitch.toLowerCase();
  if (reply.factsUsed.length >= 2) q += 0.15;
  if (reply.factsUsed.length >= 4) q += 0.1;
  if (likes.some((l) => p.includes(l.toLowerCase()))) q += 0.15;
  if (reply.bookingLink) q += 0.15;
  if (reply.availability !== "unknown") q += 0.1;
  if (/unclaimed|public data/.test(p)) q -= 0.1;
  if (reply.pitch.length < 50) q -= 0.1;
  return Math.max(0, Math.min(1, q));
}

export function reasonCodes(target: CandidateResult, winner: CandidateResult): ReasonCode[] {
  const codes: { code: ReasonCode; gap: number }[] = [];
  if (target.reply?.availability === "closed") codes.push({ code: "CLOSED", gap: 1 });
  const aGap = winner.normAffinity - target.normAffinity;
  if (aGap > TASTE_GAP_THRESHOLD) codes.push({ code: "TASTE_GAP", gap: aGap });
  if (target.reply && (target.reply.availability === "unknown" || target.reply.priceFit === "unknown")) {
    codes.push({ code: "INFO_GAP", gap: 0.5 });
  }
  const qGap = winner.Q - target.Q;
  if (qGap > PITCH_GAP_THRESHOLD) codes.push({ code: "PITCH_GAP", gap: qGap });
  if (!codes.length) codes.push({ code: aGap >= qGap ? "TASTE_GAP" : "PITCH_GAP", gap: 0 });
  return codes.sort((a, b) => b.gap - a.gap).map((c) => c.code);
}

/** Pick the winner and compute reason codes when the target loses. */
export function decide(cands: CandidateResult[]): { winner: CandidateResult; codes: ReasonCode[] } {
  const eligible = cands.filter((c) => c.asked);
  const pool = eligible.length ? eligible : cands;
  const winner = [...pool].sort((a, b) => b.score - a.score || b.normAffinity - a.normAffinity)[0];
  const target = cands.find((c) => c.isTarget);
  const codes = target && winner.venueId !== target.venueId ? reasonCodes(target, winner) : [];
  return { winner, codes };
}

export function summarize(rounds: RoundDoc[], segments: Segment[], targetId: string): RunSummary {
  const done = rounds.filter((r) => r.status === "done");
  const wins = done.filter((r) => r.winnerVenueId === targetId).length;
  const bySegment = segments.map((s) => {
    const rs = done.filter((r) => r.persona.segmentId === s.id);
    return { segmentId: s.id, name: s.name, n: rs.length, wins: rs.filter((r) => r.winnerVenueId === targetId).length };
  });
  const reasonCounts: Record<ReasonCode, number> = { TASTE_GAP: 0, INFO_GAP: 0, PITCH_GAP: 0, CLOSED: 0 };
  const lost = new Map<string, { name: string; losses: number; reasons: Map<ReasonCode, number>; segs: Map<string, number> }>();
  for (const r of done) {
    if (r.winnerVenueId === targetId || !r.winnerVenueId) continue;
    // Each loss counts once, under its main (largest gap) reason code.
    const primary = r.reasonCodes[0];
    if (primary) reasonCounts[primary]++;
    const e = lost.get(r.winnerVenueId) ?? { name: r.winnerName ?? "Rival", losses: 0, reasons: new Map(), segs: new Map() };
    e.losses++;
    if (primary) e.reasons.set(primary, (e.reasons.get(primary) ?? 0) + 1);
    e.segs.set(r.persona.segmentName, (e.segs.get(r.persona.segmentName) ?? 0) + 1);
    lost.set(r.winnerVenueId, e);
  }
  const top = <K,>(m: Map<K, number>): K | null => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const lostTo = [...lost.entries()]
    .map(([venueId, e]) => ({ venueId, name: e.name, losses: e.losses, mainReason: top(e.reasons), topSegment: top(e.segs) }))
    .sort((a, b) => b.losses - a.losses);
  return {
    soav: done.length ? wins / done.length : 0,
    wins,
    total: done.length,
    bySegment,
    lostTo,
    reasonCodes: reasonCounts,
    weights: { ...WEIGHTS },
  };
}

export const REASON_TEXT: Record<ReasonCode, string> = {
  TASTE_GAP: "The winner matched this persona's taste better",
  INFO_GAP: "Your card left hours or price unknown",
  PITCH_GAP: "Your reply was less specific than the winner's",
  CLOSED: "You were closed at the requested time",
};

export const CATEGORY_NOUN: Record<Category, string> = {
  bar: "bar",
  restaurant: "restaurant",
  cafe: "cafe",
  music_venue: "music venue",
};
