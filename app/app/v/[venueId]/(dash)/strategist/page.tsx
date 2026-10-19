import Link from "next/link";
import type { Metadata } from "next";
import { StrategistPanel } from "@/components/views/StrategistPanel";
import { EmptyState, PageHeader } from "@/components/views/PageHeader";
import { pageOwnerVenue } from "@/lib/guard";
import { listRuns } from "@/lib/arena/engine";
import { listActions } from "@/lib/agents/strategist";
import { openerFor } from "@/lib/agents/strategist-chat";

export const metadata: Metadata = { title: "Strategist" };
export const dynamic = "force-dynamic";

export default async function StrategistPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const runs = await listRuns(venue.id);
  const run = runs.find((r) => r.status === "complete" && r.label === "baseline" && r.summary);
  if (!run) {
    return (
      <>
        <PageHeader label={`${venue.name} · Growth Strategist`} title={<>Moves to get <em className="text-signal-text">picked</em>.</>} />
        <EmptyState title="Nothing to fix yet." body="Run the arena first. The Strategist reads every lost pick and turns it into ranked fixes with Qloo evidence." action={<Link href={`/app/v/${venue.id}/arena`} className="btn btn-signal">Run the arena</Link>} />
      </>
    );
  }
  const actions = (await listActions(venue.id)).filter((a) => a.runId === run.id).sort((a, b) => a.rank - b.rank);
  return (
    <StrategistPanel
      venueId={venue.id}
      runId={run.id}
      runNumber={run.number}
      actions={actions}
      segments={run.segments.map((s) => ({ id: s.id, name: s.name, seedPool: s.seedPool.slice(0, 8), evidence: s.evidence }))}
      opener={openerFor(run, actions)}
      readOnly={false}
    />
  );
}
