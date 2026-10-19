import type { Metadata } from "next";
import { CompareView } from "@/components/views/CompareView";
import { pageOwnerVenue } from "@/lib/guard";
import { listRuns } from "@/lib/arena/engine";
import { listActions } from "@/lib/agents/strategist";

export const metadata: Metadata = { title: "Before and after" };
export const dynamic = "force-dynamic";

export default async function ComparePage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const runs = await listRuns(venue.id);
  const after = runs.find((r) => r.label === "what-if") ?? null;
  const before = after ? runs.find((r) => r.id === after.parentRunId) ?? null : runs.find((r) => r.label === "baseline" && r.summary) ?? null;
  const actions = await listActions(venue.id);
  return <CompareView venue={venue} before={before} after={after} actions={actions} base={`/app/v/${venue.id}`} />;
}
