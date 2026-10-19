// Read helpers shared by pages.
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { getDemoMeta } from "@/lib/demo";
import { getVenue, listRivals } from "@/lib/venues";
import { fmtClock } from "@/lib/format";
import type { ReasonCode, RoundDoc, RunDoc } from "@/lib/types";

export async function getDemoData() {
  const meta = await getDemoMeta();
  if (!meta || meta.status !== "ready" || !meta.baselineRunId) return null;
  const [venue, baseline, whatIf] = await Promise.all([
    getVenue(meta.venueId),
    db().get<RunDoc>(P.run(meta.baselineRunId)),
    meta.whatIfRunId ? db().get<RunDoc>(P.run(meta.whatIfRunId)) : Promise.resolve(null),
  ]);
  if (!venue || !baseline) return null;
  const rounds = await db().list<RoundDoc>(P.rounds(baseline.id), { where: [["status", "==", "done"]], limit: 60 });
  const ticker = rounds
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
    .slice(0, 6)
    .map((r) => ({
      time: fmtClock(r.finishedAt ?? r.createdAt),
      who: `${r.persona.displayName}, ${r.persona.occasion}`,
      winner: r.winnerName ?? "",
      won: r.targetWon,
      code: (r.reasonCodes[0] ?? null) as ReasonCode | null,
    }));
  const rivals = await listRivals(venue.id);
  return { meta, venue, baseline, whatIf, ticker, rivalNames: rivals.map((r) => r.name) };
}
