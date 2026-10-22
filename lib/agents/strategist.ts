// Growth Strategist: turns losses into ranked, evidence backed actions, applies card fixes,
// and records measured lift after a what-if re-run with the same personas.
import { splitLift } from "@/lib/lift";
import { z } from "zod";
import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import { llmObject } from "@/lib/llm";
import { cardVersion, getVenue, latestCard, saveCard } from "@/lib/venues";
import { DAY_LABEL, type ActionDoc, type CardFacts, type Day, type Evidence, type ReasonCode, type RoundDoc, type RunDoc, type Venue } from "@/lib/types";

const MAX_ACTIONS = 5;

const DEFAULT_HOURS: Record<string, Record<Day, string>> = {
  bar: { mon: "closed", tue: "17:00-00:00", wed: "17:00-00:00", thu: "17:00-01:00", fri: "17:00-02:00", sat: "17:00-02:00", sun: "closed" },
  music_venue: { mon: "closed", tue: "closed", wed: "19:00-01:00", thu: "19:00-02:00", fri: "19:00-03:00", sat: "19:00-03:00", sun: "closed" },
  restaurant: { mon: "closed", tue: "17:30-22:00", wed: "17:30-22:00", thu: "17:30-22:30", fri: "17:30-23:00", sat: "17:00-23:00", sun: "17:00-21:30" },
  cafe: { mon: "08:00-17:00", tue: "08:00-17:00", wed: "08:00-17:00", thu: "08:00-17:00", fri: "08:00-17:00", sat: "09:00-16:00", sun: "09:00-16:00" },
};

const PitchOut = z.object({ voice: z.string().min(20).max(600), vibe: z.string().max(200).nullable() });

function countBy<T>(xs: T[], key: (x: T) => string | null) {
  const m = new Map<string, number>();
  for (const x of xs) {
    const k = key(x);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function evidenceOf(rounds: RoundDoc[]): Evidence | null {
  return rounds.find((r) => r.affinityEvidence)?.affinityEvidence ?? null;
}

/** "Thursday DJ night", or "Weekend brunch" when the theme is a daytime one. */
export function eventTitle(theme: string): string {
  const t = theme
    .split(" ")
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) || /^dj$/i.test(w) ? w.toUpperCase() : w.toLowerCase()))
    .join(" ");
  if (/brunch|breakfast|coffee|lunch|bakery|cafe/i.test(t)) return /brunch/i.test(t) ? "Weekend brunch" : `Weekend ${t}`;
  return `Thursday ${t} night`;
}

export async function generateActions(run: RunDoc, rounds: RoundDoc[]): Promise<ActionDoc[]> {
  const venue = await getVenue(run.venueId);
  if (!venue) return [];
  const card = (await cardVersion(venue.id, run.cardVersion)) ?? (await latestCard(venue.id));
  if (!card) return [];
  const f = card.facts;
  const lost = rounds.filter((r) => r.status === "done" && !r.targetWon);
  const by = (code: ReasonCode) => lost.filter((r) => r.reasonCodes.includes(code));
  const actions: Omit<ActionDoc, "id" | "rank" | "createdAt" | "status" | "measuredLift">[] = [];

  // 1. Missing hours (INFO_GAP)
  const info = by("INFO_GAP");
  // The report counts each loss once, under its biggest gap. Use the same count in labels so the numbers match.
  const infoMain = lost.filter((r) => r.reasonCodes[0] === "INFO_GAP");
  const hoursMissing = !f.hours || Object.values(f.hours).every((v) => !v);
  if (info.length && hoursMissing) {
    const days = countBy(info, (r) => r.persona.slot.day).slice(0, 2).map(([d]) => DAY_LABEL[d as Day]);
    actions.push({
      runId: run.id,
      kind: "card_fact",
      title: days.length === 2 ? `Add ${days[0]} and ${days[1]} hours` : "Add your opening hours",
      detail: infoMain.length
        ? `${info.length} agents got "unknown" when they asked if you were open. In ${infoMain.length} losses that was the deciding gap, and they picked a venue that could confirm.`
        : `${info.length} agents got "unknown" when they asked if you were open. Hours are the easiest gap to close on your card.`,
      reasonCode: "INFO_GAP",
      segmentName: countBy(info, (r) => r.persona.segmentName)[0]?.[0] ?? null,
      evidence: evidenceOf(info),
      evidenceLabel: infoMain.length ? `${infoMain.length} INFO_GAP losses` : `${info.length} hours unknown`,
      estLift: Math.max(1, Math.round(info.length * 0.35)),
      liftType: "measured",
      patch: { hours: DEFAULT_HOURS[venue.category] ?? DEFAULT_HOURS.bar },
    });
  }

  // 2. Booking link and price (INFO_GAP or PITCH_GAP)
  if (!f.booking && lost.length) {
    const n = info.length + by("PITCH_GAP").length;
    actions.push({
      runId: run.id,
      kind: "card_fact",
      title: "Add a booking link",
      detail: "Concierge agents favour replies they can act on. Without a link your agent cannot hand the guest a next step.",
      reasonCode: "INFO_GAP",
      segmentName: null,
      evidence: evidenceOf(lost),
      evidenceLabel: "Answer quality weight 15%",
      estLift: Math.max(1, Math.round(n * 0.12)),
      liftType: "measured",
      patch: { booking: "", ...(f.priceBand ? {} : { priceBand: "$$" as const }) },
    });
  }

  // 3. Pitch (PITCH_GAP)
  const pitchGap = by("PITCH_GAP");
  const genericVoice = card.voice.trim().length <= 40;
  // Generic replies also lose ties, so a thin voice triggers the pitch fix too.
  const pitch = pitchGap.length ? pitchGap : genericVoice ? lost.filter((r) => r.persona.occasion === "date night" || r.persona.occasion === "solo drink") : [];
  if (pitch.length) {
    const occasion = countBy(pitch, (r) => r.persona.occasion)[0]?.[0] ?? "date night";
    const seg = countBy(pitch, (r) => r.persona.segmentName)[0]?.[0] ?? null;
    // Music and films describe a crowd better than brands do, so brands only fill gaps.
    const seedsAll = pitch.flatMap((r) => r.persona.seeds);
    const nonBrand = seedsAll.filter((x) => !/brand/i.test(x.type ?? ""));
    const likes = countBy(nonBrand.length >= 3 ? nonBrand : seedsAll, (s) => s.name).slice(0, 3).map(([n]) => n);
    const tagNames = venue.qlooTags.slice(0, 4).map((t) => t.name.toLowerCase());
    let voice = `Warm and specific. For ${occasion} requests, describe the room, name one drink and one dish, and say when you are open. Our crowd loves ${likes.join(", ")}; mention ${tagNames.slice(0, 2).join(" and ")} when it fits.${occasion === "date night" ? " For dates, say what makes the room good for two." : ""}`;
    let vibe = f.vibe;
    const out = await llmObject({
      tier: "smart",
      schema: PitchOut,
      system:
        "You write voice notes that a venue's AI agent will follow when pitching to other agents. Only state venue facts found in currentVibe and currentMusic. crowdLoves and tasteTags describe what the crowd likes elsewhere, not what the venue plays or serves, so mention them only as the crowd's taste (for example: guests who love X feel at home here). Never invent menu items, prices or music. Plain English, no em dashes, no hyphenated phrases.",
      prompt: JSON.stringify({ venue: venue.name, occasion, crowdLoves: likes, tasteTags: tagNames, currentVibe: f.vibe, currentMusic: f.music }),
    });
    if (out) {
      voice = out.voice.replace(/—/g, ",");
      vibe = out.vibe ?? vibe;
    }
    actions.push({
      runId: run.id,
      kind: "pitch",
      title: `Sharpen your ${occasion} pitch`,
      detail: pitchGap.length
        ? `${pitchGap.length} replies were less specific than the winner's. Qloo shows this crowd also loves ${likes.slice(0, 2).join(" and ")}, so say that.`
        : `Your agent has almost no voice notes, so its replies read the same for every request. ${pitch.length} ${occasion} requests went elsewhere. Qloo shows this crowd loves ${likes.slice(0, 2).join(" and ")}.`,
      reasonCode: "PITCH_GAP",
      segmentName: seg,
      evidence: evidenceOf(pitch),
      evidenceLabel: `Crowd loves ${likes[0] ?? "your music"}`,
      estLift: Math.max(1, Math.round(pitch.length * (pitchGap.length ? 0.3 : 0.12))),
      liftType: "measured",
      patch: { voice, ...(vibe ? { vibe } : {}) },
    });
  }

  // 4. Taste gap: an event for the segment you lose most on taste (estimated)
  const taste = by("TASTE_GAP");
  if (taste.length) {
    const segName = countBy(taste, (r) => r.persona.segmentName)[0]?.[0] ?? null;
    const seg = run.segments.find((s) => s.name === segName);
    const artist = seg?.seedPool.find((s) => s.type === "artist");
    const theme = seg?.tagNames[0] ?? segName ?? "themed";
    const segLosses = taste.filter((r) => r.persona.segmentName === segName).length;
    actions.push({
      runId: run.id,
      kind: "event",
      title: eventTitle(theme),
      detail: `${segName ?? "One segment"} goes to rivals on taste (${segLosses} losses). Qloo links this crowd to ${artist?.name ?? theme}. A recurring night gives agents a reason to pick you.`,
      reasonCode: "TASTE_GAP",
      segmentName: segName,
      evidence: seg?.evidence ?? evidenceOf(taste),
      evidenceLabel: artist ? `Affinity: ${artist.name}` : `Tag: ${theme}`,
      estLift: Math.max(1, Math.round(segLosses * 0.45)),
      liftType: "estimated",
      patch: { events: [...f.events, eventTitle(theme).startsWith("Weekend") ? { title: eventTitle(theme), when: "Saturdays and Sundays from 11am" } : { title: `${theme} night`, when: "Thursdays from 8pm" }] },
    });
  }

  // 5. Closed at popular slots (estimated, it is a business change)
  const closed = by("CLOSED");
  if (closed.length) {
    const [day] = countBy(closed, (r) => r.persona.slot.day)[0] ?? ["sun"];
    const time = countBy(closed.filter((r) => r.persona.slot.day === day), (r) => r.persona.slot.time)[0]?.[0] ?? "13:00";
    const h = Number(time.split(":")[0]);
    actions.push({
      runId: run.id,
      kind: "hours",
      title: `${DAY_LABEL[day as Day]}s from ${h > 12 ? h - 12 : h}${h >= 12 ? "pm" : "am"}`,
      detail: `${closed.length} requests came when you were closed, mostly ${DAY_LABEL[day as Day]} around ${time}. Opening earlier would put you in those conversations.`,
      reasonCode: "CLOSED",
      segmentName: countBy(closed, (r) => r.persona.segmentName)[0]?.[0] ?? null,
      evidence: evidenceOf(closed),
      evidenceLabel: `${closed.length} CLOSED losses`,
      estLift: Math.max(1, Math.round(closed.length * 0.4)),
      liftType: "estimated",
      patch: { hours: { ...(f.hours ?? DEFAULT_HOURS[venue.category] ?? DEFAULT_HOURS.bar), [day]: `${time}-23:00` } as CardFacts["hours"] },
    });
  }

  // Replace earlier proposals, keep applied history.
  const old = await db().list<ActionDoc>(P.actions(venue.id));
  await Promise.all(old.filter((a) => a.status !== "applied").map((a) => db().delete(P.action(venue.id, a.id))));

  // Card fixes come first when the card actually cost picks. When no loss was mainly about missing info
  // or a vague reply, the card is already doing its job, so the business ideas (events, hours) lead.
  const cardLosses = lost.filter((r) => r.reasonCodes[0] === "INFO_GAP" || r.reasonCodes[0] === "PITCH_GAP").length;
  const measuredFirst = cardLosses > 0;
  const ranked = actions
    .sort((a, b) =>
      a.liftType === b.liftType ? b.estLift - a.estLift : (a.liftType === "measured") === measuredFirst ? -1 : 1,
    )
    .slice(0, MAX_ACTIONS)
    .map((a, i) => ({ ...a, id: newId(14), rank: i + 1, status: "proposed" as const, measuredLift: null, createdAt: Date.now() }));
  await Promise.all(ranked.map((a) => db().set(P.action(venue.id, a.id), { ...a })));
  return ranked;
}

export async function listActions(venueId: string) {
  const rows = await db().list<ActionDoc>(P.actions(venueId));
  return rows.sort((a, b) => b.createdAt - a.createdAt || a.rank - b.rank);
}

export async function setActionStatus(venueId: string, actionId: string, status: ActionDoc["status"]) {
  await db().update(P.action(venueId, actionId), { status });
}

/**
 * Apply accepted card and pitch actions as one new card version. Event and hours ideas stay
 * "accepted" (estimated lift only) and never change the measured run.
 */
export async function applyActions(
  venueId: string,
  actionIds: string[],
  overrides: Record<string, Partial<CardFacts> & { voice?: string }> = {},
): Promise<{ cardVersion: number; applied: string[] }> {
  const card = await latestCard(venueId);
  if (!card) throw new Error("No agent card");
  let facts: CardFacts = { ...card.facts };
  let voice = card.voice;
  const applied: string[] = [];
  for (const id of actionIds) {
    const a = await db().get<ActionDoc>(P.action(venueId, id));
    if (!a) continue;
    if (a.liftType !== "measured") {
      await setActionStatus(venueId, id, "accepted");
      continue;
    }
    const patch = { ...a.patch, ...(overrides[id] ?? {}) };
    const { voice: v, ...rest } = patch;
    if ("booking" in rest && !rest.booking) throw new Error(`"${a.title}" needs a booking link before it can be applied.`);
    facts = { ...facts, ...rest } as CardFacts;
    if (v) voice = v;
    applied.push(id);
  }
  if (!applied.length) return { cardVersion: card.version, applied };
  const saved = await saveCard(venueId, facts, voice, `Strategist fixes: ${applied.length}`);
  await Promise.all(applied.map((id) => db().update(P.action(venueId, id), { status: "applied" })));
  return { cardVersion: saved.version, applied };
}

/** After a what-if run: measured lift = wins after minus wins before, same personas. */
export async function recordMeasuredLift(run: RunDoc, venue: Venue | null) {
  if (!run.parentRunId || !run.summary || !venue) return;
  const parent = await db().get<RunDoc>(P.run(run.parentRunId));
  if (!parent?.summary) return;
  const acts = (await listActions(venue.id)).filter((a) => run.appliedActionIds.includes(a.id));
  const shares = splitLift(run.summary.wins - parent.summary.wins, acts);
  // Awaited: on serverless the work can be frozen as soon as the function returns.
  await Promise.all(acts.map((a) => db().update(P.action(venue.id, a.id), { measuredLift: shares[a.id] })));
}
