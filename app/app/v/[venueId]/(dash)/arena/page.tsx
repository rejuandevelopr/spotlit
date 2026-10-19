import type { Metadata } from "next";
import { ArenaView } from "@/components/views/ArenaView";
import { pageOwnerVenue } from "@/lib/guard";
import { env } from "@/lib/env";
import { getProfile, listRivals } from "@/lib/venues";
import { listRuns } from "@/lib/arena/engine";

export const metadata: Metadata = { title: "Arena" };
export const dynamic = "force-dynamic";

export default async function ArenaPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const [runs, rivals, profile] = await Promise.all([listRuns(venue.id), listRivals(venue.id), getProfile(venue.id)]);
  const max = Math.max(12, env.maxPersonasPublic);
  const options = [12, 24, 60].filter((n) => n <= max);
  const running = runs.find((r) => r.status === "running");
  const disabled = running ? "A run is already playing. Open it below." : !profile ? "Build your Taste DNA first." : null;
  return <ArenaView venue={venue} runs={runs} rivals={rivals} options={options} base={`/app/v/${venue.id}`} readOnly={false} disabledReason={disabled} />;
}
