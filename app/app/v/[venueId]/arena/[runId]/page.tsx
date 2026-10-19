import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArenaTheatre } from "@/components/views/ArenaTheatre";
import { pageOwnerVenue } from "@/lib/guard";
import { getRun } from "@/lib/arena/engine";
import { livePayload } from "@/lib/live";

export const metadata: Metadata = { title: "Agent Arena" };
export const dynamic = "force-dynamic";

export default async function ArenaLivePage({ params }: { params: Promise<{ venueId: string; runId: string }> }) {
  const { venueId, runId } = await params;
  await pageOwnerVenue(venueId);
  const run = await getRun(runId);
  if (!run || run.venueId !== venueId) notFound();
  const complete = run.status === "complete";
  const initial = await livePayload(run, { all: complete });
  return <ArenaTheatre runId={run.id} initial={initial} mode={complete ? "replay" : "live"} backHref={`/app/v/${venueId}/arena`} reportHref={`/app/v/${venueId}/report/${run.id}`} />;
}
