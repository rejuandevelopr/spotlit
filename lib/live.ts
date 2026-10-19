// Compact run data for the live theatre and replays.
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { getVenue } from "@/lib/venues";
import type { ReasonCode, RoundDoc, RunDoc } from "@/lib/types";

export interface LiveRound {
  id: string;
  index: number;
  who: string;
  occasion: string;
  segment: string;
  request: string;
  winner: string | null;
  targetWon: boolean;
  codes: ReasonCode[];
  reason: string;
  finishedAt: number | null;
  candidates: { venueId: string; name: string; score: number; A: number; asked: boolean; isTarget: boolean; isProxy: boolean }[];
}

export interface LivePayload {
  run: Pick<RunDoc, "id" | "venueId" | "venueName" | "number" | "label" | "status" | "progress" | "personaCount" | "seed" | "isPublicDemo" | "startedAt" | "finishedAt" | "lastTickAt"> & { wins: number };
  venues: { id: string; name: string; isTarget: boolean; isProxy: boolean }[];
  rounds: LiveRound[];
}

export function compactRound(r: RoundDoc): LiveRound {
  return {
    id: r.id,
    index: r.index,
    who: `${r.persona.displayName}`,
    occasion: r.persona.occasion,
    segment: r.persona.segmentName,
    request: r.persona.requestText,
    winner: r.winnerName,
    targetWon: r.targetWon,
    codes: r.reasonCodes,
    reason: r.reason,
    finishedAt: r.finishedAt,
    candidates: r.candidates.map((c) => ({ venueId: c.venueId, name: c.name, score: c.score, A: c.normAffinity, asked: c.asked, isTarget: c.isTarget, isProxy: c.isProxy })),
  };
}

export async function livePayload(run: RunDoc, opts: { all?: boolean } = {}): Promise<LivePayload> {
  const done = await db().list<RoundDoc>(P.rounds(run.id), { where: [["status", "==", "done"]] });
  done.sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  const wins = done.filter((r) => r.targetWon).length;
  const venues = await Promise.all(
    run.candidateIds.map(async (id) => {
      const v = await getVenue(id);
      return { id, name: v?.name ?? "Venue", isTarget: id === run.venueId, isProxy: !!v && v.isProxy && !v.isClaimed };
    }),
  );
  return {
    run: {
      id: run.id,
      venueId: run.venueId,
      venueName: run.venueName,
      number: run.number,
      label: run.label,
      status: run.status,
      progress: run.progress,
      personaCount: run.personaCount,
      seed: run.seed,
      isPublicDemo: run.isPublicDemo,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      lastTickAt: run.lastTickAt,
      wins,
    },
    venues,
    rounds: (opts.all ? done : done.slice(0, 14)).map(compactRound),
  };
}
