// Concierge agent: rates venue replies for answer quality (Q) and writes a one line reason.
// Final scores and the winner are always computed in code.
import { z } from "zod";
import { llmObject } from "@/lib/llm";
import { env } from "@/lib/env";
import { heuristicQuality } from "@/lib/arena/scoring";
import { DAY_LABEL, type CandidateResult, type Persona, type ReasonCode } from "@/lib/types";

// Kept loose on purpose: Gemini sometimes rates on a 0 to 10 scale or writes long notes.
// We clean the values in code instead of rejecting the whole answer.
const RateOut = z.object({
  ratings: z.array(z.object({ venueId: z.string(), Q: z.coerce.number(), notes: z.string().optional() })),
});

/** Brings a rating into 0..1, accepting 0..1, 0..10 or 0..100 scales. */
export function normQ(q: number): number {
  if (!Number.isFinite(q)) return 0.5;
  const v = q > 10 ? q / 100 : q > 1 ? q / 10 : q;
  return Math.min(1, Math.max(0, v));
}

const SYSTEM = `You are a concierge agent judging replies from venue agents for one person's request.
Rate each reply's answer quality Q as a decimal from 0 to 1 (not 0 to 10): specific to the request, honest about unknowns, bookable, relevant to the person's tastes.
Generic or evasive replies score low. Replies that say hours are not listed lose some points. Do not judge taste fit, that is measured separately. Keep notes under 20 words. Use the exact venueId values you were given.`;

export async function rateReplies(persona: Persona, cands: CandidateResult[], likes: string[]): Promise<Record<string, number>> {
  const asked = cands.filter((c) => c.asked && c.reply);
  const heuristic: Record<string, number> = {};
  for (const c of asked) heuristic[c.venueId] = heuristicQuality(c.reply!, likes);
  if (env.arenaLlm === "off") return heuristic;
  const out = await llmObject({
    tier: "smart",
    schema: RateOut,
    system: SYSTEM,
    cache: true,
    temperature: 0.1,
    prompt: JSON.stringify({
      request: persona.requestText,
      replies: asked.map((c) => ({ venueId: c.venueId, pitch: c.reply!.pitch, availability: c.reply!.availability, bookingLink: !!c.reply!.bookingLink })),
    }),
  });
  if (!out) return heuristic;
  const rated: Record<string, number> = { ...heuristic };
  for (const r of out.ratings) if (r.venueId in rated) rated[r.venueId] = Math.round((0.7 * normQ(r.Q) + 0.3 * heuristic[r.venueId]) * 100) / 100;
  return rated;
}

export function verdictReason(persona: Persona, winner: CandidateResult, target: CandidateResult | undefined, codes: ReasonCode[], sharedTaste: string[]) {
  const when = `${DAY_LABEL[persona.slot.day]} ${persona.slot.time}`;
  if (target && winner.venueId === target.venueId) {
    const taste = sharedTaste.length ? `Strong taste match on ${sharedTaste.slice(0, 2).join(" and ").toLowerCase()}` : "Best overall taste match";
    const open = winner.reply?.availability === "open" ? `, open ${when}` : "";
    const price = winner.reply?.priceFit === "yes" ? ", inside budget" : "";
    return `${taste}${open}${price}.`;
  }
  const code = codes[0];
  const why: Record<ReasonCode, string> = {
    TASTE_GAP: `${winner.name} matched this persona's taste better`,
    INFO_GAP: `${winner.name} could confirm ${winner.reply?.availability === "open" ? "hours" : "details"}, your card could not`,
    PITCH_GAP: `${winner.name} gave a more specific answer`,
    CLOSED: `You were closed ${when}`,
  };
  return `${why[code ?? "TASTE_GAP"]}.`;
}
