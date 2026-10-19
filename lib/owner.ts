// Owner dashboard data.
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { latestCard, listOwnerVenues } from "@/lib/venues";
import { readinessItems } from "@/lib/readiness";
import type { ActionDoc, InboxDoc, RunDoc, Venue } from "@/lib/types";

export interface VenueCardData {
  venue: Venue;
  setupDone: number;
  nextStep: { label: string; href: string } | null;
  asksThisWeek: number;
  lastRun: RunDoc | null;
  actionsWaiting: number;
}

export async function venueCardData(venue: Venue): Promise<VenueCardData> {
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const [card, inbox, actions, lastRun, profile] = await Promise.all([
    latestCard(venue.id),
    db().list<InboxDoc>(P.inbox(venue.id), { where: [["createdAt", ">=", weekAgo]] }),
    db().list<ActionDoc>(P.actions(venue.id), { where: [["status", "==", "proposed"]] }),
    venue.latestRunId ? db().get<RunDoc>(P.run(venue.latestRunId)) : Promise.resolve(null),
    db().get(P.taste(venue.id)),
  ]);
  const hasDna = !!profile;
  const cardReady = (card?.readiness ?? 0) >= 60;
  const hasRun = !!venue.latestRunId;
  const setupDone = [venue.isClaimed, hasDna, cardReady, hasRun].filter(Boolean).length;
  let nextStep: VenueCardData["nextStep"] = null;
  if (!hasDna) nextStep = { label: "Next: build your Taste DNA from Qloo", href: `/app/v/${venue.id}/dna` };
  else if (!cardReady && card) {
    const missing = readinessItems(card.facts, card.voice).filter((i) => !i.done).slice(0, 3).map((i) => i.label.toLowerCase());
    nextStep = { label: `Next: add ${missing.join(", ")} to the agent card`, href: `/app/v/${venue.id}/card` };
  } else if (!hasRun) nextStep = { label: "Next: run your first arena", href: `/app/v/${venue.id}/arena` };
  return { venue, setupDone, nextStep, asksThisWeek: inbox.length, lastRun, actionsWaiting: actions.length };
}

export async function ownerDashboard(uid: string) {
  const venues = await listOwnerVenues(uid);
  const cards = await Promise.all(venues.map(venueCardData));
  const activity: { at: number; text: string; badge?: string; href?: string; hrefLabel?: string }[] = [];
  for (const c of cards) {
    activity.push({ at: c.venue.createdAt, text: `You added ${c.venue.name}` });
    const inbox = await db().list<InboxDoc>(P.inbox(c.venue.id), { orderBy: ["createdAt", "desc"], limit: 4 });
    for (const i of inbox) {
      activity.push({
        at: i.createdAt,
        text: `${i.fromAgent} asked ${c.venue.name}: "${i.request.slice(0, 80)}${i.request.length > 80 ? "…" : ""}"`,
        badge: i.outcome,
      });
    }
    const runs = await db().list<RunDoc>(P.runs(), { where: [["venueId", "==", c.venue.id]] });
    for (const r of runs.filter((x) => x.status === "complete" && x.summary)) {
      activity.push({
        at: r.finishedAt ?? r.startedAt,
        text: `Run ${String(r.number).padStart(2, "0")} finished for ${c.venue.name}: ${r.summary!.wins} of ${r.summary!.total} picks`,
        href: r.label === "what-if" ? `/app/v/${c.venue.id}/compare` : `/app/v/${c.venue.id}/report/${r.id}`,
        hrefLabel: r.label === "what-if" ? "See lift" : "Open report",
      });
    }
  }
  activity.sort((a, b) => b.at - a.at);
  return { cards, activity: activity.slice(0, 8) };
}
