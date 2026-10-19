// One arena round: a persona asks the concierge, the concierge scores candidates with Qloo,
// asks venue agents over A2A, rates replies and picks a winner.
import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import { scoreCandidates, tasteTags } from "@/lib/qloo/endpoints";
import { askVenue } from "@/lib/a2a/client";
import { personaRequest, templateRequest } from "@/lib/agents/persona";
import { env } from "@/lib/env";
import { venueText } from "@/lib/agents/venue";
import { rateReplies, verdictReason } from "@/lib/agents/concierge";
import { combineAffinity, constraintFit, decide, score, tagOverlap } from "./scoring";
import type { AgentCardDoc, CandidateResult, MessageDoc, RoundDoc, RunDoc, Venue } from "@/lib/types";

export interface RoundContext {
  run: RunDoc;
  venues: Venue[]; // candidates, target first
  cards: Map<string, AgentCardDoc>;
}

const ASK_TOP = 4;

export async function playRound(ctx: RoundContext, round: RoundDoc): Promise<Partial<RoundDoc>> {
  const { run, venues, cards } = ctx;
  const persona = { ...round.persona };
  if (!persona.requestText) persona.requestText = env.arenaLlm === "all" ? await personaRequest(persona, run.city, run.area) : templateRequest(persona, run.city, run.area);
  const likes = persona.seeds.map((s) => s.name);
  const seedIds = persona.seeds.map((s) => s.id);
  const qctx = { runId: run.id };

  // 1. Qloo: what this persona's taste is associated with.
  const personaAff = new Map<string, number>();
  let affinityEvidence = null;
  try {
    const r = await tasteTags({ entities: seedIds }, qctx, 50);
    affinityEvidence = r.evidence;
    r.data.forEach((t, i) => {
      const a = t.affinity ?? 1 - i / Math.max(1, r.data.length);
      personaAff.set(t.id, a);
      personaAff.set(t.name.toLowerCase(), a);
    });
  } catch {
    // Without tag affinities every venue gets the same tag score; entity scores still apply.
  }

  // 2. Qloo: one call scores every candidate place with a Qloo entity.
  let entityAff: Record<string, number> = {};
  const entityIds = venues.map((v) => v.qlooEntityId).filter(Boolean) as string[];
  try {
    const r = await scoreCandidates(seedIds, entityIds, qctx);
    entityAff = r.data;
    affinityEvidence ??= r.evidence;
  } catch {
    entityAff = {};
  }

  const tagScores = venues.map((v) => tagOverlap(v.qlooTags, personaAff));
  const entScores = venues.map((v) => (v.qlooEntityId ? (entityAff[v.qlooEntityId] ?? 0) : null));
  const A = combineAffinity(tagScores, entScores);

  const cands: CandidateResult[] = venues.map((v, i) => ({
    venueId: v.id,
    name: v.name,
    isTarget: v.id === run.venueId,
    isProxy: v.isProxy && !v.isClaimed,
    affinity: Math.round((entScores[i] ?? tagScores[i]) * 1000) / 1000,
    normAffinity: Math.round(A[i] * 1000) / 1000,
    C: 0,
    Q: 0,
    score: 0,
    reply: null,
    asked: false,
  }));

  // 3. Ask the top venues by taste, and always the target, over A2A.
  const order = [...cands].sort((a, b) => b.normAffinity - a.normAffinity);
  const toAsk = new Set(order.slice(0, ASK_TOP).map((c) => c.venueId));
  toAsk.add(run.venueId);

  const constraints = {
    day: persona.slot.day,
    time: persona.slot.time,
    partySize: persona.partySize,
    budget: persona.budget,
    occasion: persona.occasion,
    likes,
  };
  const messages: MessageDoc[] = [];
  await Promise.all(
    cands
      .filter((c) => toAsk.has(c.venueId))
      .map(async (c) => {
        const v = venues.find((x) => x.id === c.venueId)!;
        const ex = await askVenue(v.slug, { text: persona.requestText, constraints }, { runId: run.id });
        c.reply = ex.reply;
        c.asked = !!ex.reply;
        messages.push({
          id: newId(14),
          personaId: persona.id,
          fromAgent: "concierge",
          toAgent: v.name,
          direction: "request",
          method: "message/send",
          payload: { text: persona.requestText, transport: ex.transport, reply: ex.reply ? { pitch: ex.reply.pitch, availability: ex.reply.availability, priceFit: ex.reply.priceFit } : null },
          createdAt: Date.now(),
        });
      }),
  );

  // 4. Constraint fit in code, answer quality from the concierge.
  const Q = await rateReplies(persona, cands, likes);
  for (const c of cands) {
    if (!c.asked || !c.reply) continue;
    const v = venues.find((x) => x.id === c.venueId)!;
    const card = cards.get(v.id);
    c.C = Math.round(constraintFit(c.reply, { partySize: persona.partySize, partyMax: card?.facts.partyMax ?? null, occasion: persona.occasion, venueText: card ? venueText(v, card) : v.name }) * 1000) / 1000;
    c.Q = Q[c.venueId] ?? 0;
    c.score = Math.round(score(c.normAffinity, c.C, c.Q) * 1000) / 1000;
  }

  const { winner, codes } = decide(cands);
  const target = cands.find((c) => c.isTarget);
  const targetVenue = venues.find((v) => v.id === run.venueId);
  const shared = (targetVenue?.qlooTags ?? [])
    .filter((t) => (personaAff.get(t.id) ?? personaAff.get(t.name.toLowerCase()) ?? 0) > 0.3)
    .map((t) => t.name);

  await Promise.all(messages.map((m) => db().set(P.message(run.id, m.id), { ...m }).catch(() => undefined)));

  return {
    persona,
    candidates: cands,
    winnerVenueId: winner.venueId,
    winnerName: winner.name,
    targetWon: winner.venueId === run.venueId,
    reason: verdictReason(persona, winner, target, codes, shared),
    reasonCodes: codes,
    affinityEvidence,
  };
}
