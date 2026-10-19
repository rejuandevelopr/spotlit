import { notFound } from "next/navigation";
import { DnaView } from "@/components/views/DnaView";
import { RivalsView } from "@/components/views/RivalsView";
import { CardEditor } from "@/components/views/CardEditor";
import { ArenaView } from "@/components/views/ArenaView";
import { ReportView } from "@/components/views/ReportView";
import { StrategistPanel } from "@/components/views/StrategistPanel";
import { CompareView } from "@/components/views/CompareView";
import { InboxView } from "@/components/views/InboxView";
import { demoContext } from "@/lib/demoPage";
import { getProfile, latestCard, listRivals } from "@/lib/venues";
import { listRuns } from "@/lib/arena/engine";
import { listActions } from "@/lib/agents/strategist";
import { openerFor } from "@/lib/agents/strategist-chat";
import { inboxItems, inboxStats, sanitize } from "@/lib/inbox";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { env } from "@/lib/env";
import type { AgentCardDoc, RoundDoc } from "@/lib/types";

const SECTIONS = ["dna", "rivals", "card", "report", "strategist", "compare", "inbox"] as const;

export function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  return params.then(({ section }) => ({ title: section === "dna" ? "Taste DNA" : section[0]?.toUpperCase() + section.slice(1) }));
}

export default async function DemoSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.includes(section as (typeof SECTIONS)[number])) notFound();
  const ctx = await demoContext();
  if (!ctx.ready) return null;
  const { venue, baseline, whatIf } = ctx;

  switch (section) {
    case "dna": {
      const [profile, card, rivals] = await Promise.all([getProfile(venue.id), latestCard(venue.id), listRivals(venue.id)]);
      // Show the card the baseline ran with, so readiness matches the story.
      return <DnaView venue={venue} profile={profile} card={card} rivals={rivals} base="/demo" readOnly />;
    }
    case "rivals": {
      const [rivals, profile] = await Promise.all([listRivals(venue.id), getProfile(venue.id)]);
      return <RivalsView venue={venue} rivals={rivals} profile={profile} base="/demo" readOnly />;
    }
    case "card": {
      const card = await latestCard(venue.id);
      const versions = await db().list<AgentCardDoc>(P.cards(venue.id), { orderBy: ["version", "desc"], limit: 20 });
      if (!card) return null;
      return <CardEditor venueId={venue.id} venueName={venue.name} slug={venue.slug} claimed={venue.isClaimed} card={card} versions={versions.map((v) => ({ version: v.version, createdAt: v.createdAt, readiness: v.readiness, note: v.note }))} readOnly />;
    }
    case "report": {
      const first = (await db().list<RoundDoc>(P.rounds(baseline.id), { orderBy: ["index", "asc"], limit: 1 }))[0];
      return <ReportView venue={venue} run={baseline} evidence={first?.affinityEvidence ?? null} base="/demo" readOnly canShare={false} />;
    }
    case "strategist": {
      const actions = (await listActions(venue.id)).filter((a) => a.runId === baseline.id).sort((a, b) => a.rank - b.rank);
      return (
        <StrategistPanel
          venueId={venue.id}
          runId={baseline.id}
          runNumber={baseline.number}
          actions={actions}
          segments={baseline.segments.map((s) => ({ id: s.id, name: s.name, seedPool: s.seedPool.slice(0, 8), evidence: s.evidence }))}
          opener={openerFor(baseline, actions)}
          readOnly
        />
      );
    }
    case "compare": {
      const actions = await listActions(venue.id);
      return <CompareView venue={venue} before={baseline} after={whatIf} actions={actions} base="/demo" />;
    }
    case "inbox": {
      const [items, stats] = await Promise.all([inboxItems(venue.id, 30), inboxStats(venue.id)]);
      return <InboxView venueId={venue.id} venueName={venue.name} slug={venue.slug} mcpUrl={`${env.appUrl}/api/mcp`} initialItems={sanitize(items)} stats={stats} alertsOn readOnly />;
    }
  }
  void listRuns;
  notFound();
}
