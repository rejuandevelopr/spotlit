// Analyst agent: turns the numbers (computed in code) into words. Never changes a number.
import { z } from "zod";
import { llmObject } from "@/lib/llm";
import { REASON_TEXT } from "@/lib/arena/scoring";
import { REASON_CODES, type ReasonCode, type RoundDoc, type RunDoc, type Venue } from "@/lib/types";

const Out = z.object({
  narrative: z.string().min(20).max(900),
  patterns: z.array(z.object({ code: z.enum(REASON_CODES), title: z.string().max(80), detail: z.string().max(280) })).max(3),
});

const SYSTEM = `You are an analyst summarising an Agent Arena simulation for an independent venue owner.
All numbers are final and come from code: never change or invent numbers, only quote the ones given.
Write a short narrative (3 sentences max) and up to 3 loss patterns tied to the given reason codes.
Be concrete and plain spoken. Call it a simulation. Each round is one person asking a concierge agent for a recommendation: call them requests or picks, never visits or customers. No em dashes, no hyphenated phrases.`;

export function templateAnalyst(run: RunDoc, rounds: RoundDoc[], venue: Venue | null): NonNullable<RunDoc["analyst"]> {
  const s = run.summary!;
  const best = [...s.bySegment].filter((x) => x.n).sort((a, b) => b.wins / b.n - a.wins / a.n)[0];
  const worst = [...s.bySegment].filter((x) => x.n).sort((a, b) => a.wins / a.n - b.wins / b.n)[0];
  const topRival = s.lostTo[0];
  const codes = (Object.entries(s.reasonCodes) as [ReasonCode, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const name = venue?.name ?? run.venueName;
  const narrative = [
    `In this simulation agents picked ${name} for ${s.wins} of ${s.total} requests (${Math.round(s.soav * 100)}%).`,
    best ? `You are strongest with ${best.name.toLowerCase()} (${best.wins} of ${best.n}) and weakest with ${worst?.name.toLowerCase()} (${worst?.wins} of ${worst?.n}).` : "",
    topRival ? `${topRival.name} took the most picks from you (${topRival.losses}), mostly on ${topRival.mainReason?.replace("_", " ").toLowerCase() ?? "taste"}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const patterns = codes.slice(0, 3).map(([code, n]) => {
    const segs = new Map<string, number>();
    for (const r of rounds) if (r.reasonCodes.includes(code)) segs.set(r.persona.segmentName, (segs.get(r.persona.segmentName) ?? 0) + 1);
    const seg = [...segs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      code,
      title: `${REASON_TEXT[code]} (${n})`,
      detail: seg ? `Most often with ${seg.toLowerCase()} requests.` : "Spread across segments.",
    };
  });
  return { narrative, patterns };
}

export async function runAnalyst(run: RunDoc, rounds: RoundDoc[], venue: Venue | null): Promise<NonNullable<RunDoc["analyst"]>> {
  const fallback = templateAnalyst(run, rounds, venue);
  const losses = rounds
    .filter((r) => r.status === "done" && !r.targetWon)
    .slice(0, 12)
    .map((r) => ({ persona: r.persona.displayName, segment: r.persona.segmentName, request: r.persona.requestText, winner: r.winnerName, codes: r.reasonCodes }));
  const out = await llmObject({
    tier: "smart",
    schema: Out,
    system: SYSTEM,
    prompt: JSON.stringify({ venue: venue?.name ?? run.venueName, summary: run.summary, sampleLosses: losses }),
  });
  if (!out) return fallback;
  return { narrative: out.narrative.replace(/—/g, ","), patterns: out.patterns.length ? out.patterns : fallback.patterns };
}
