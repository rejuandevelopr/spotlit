import { redirect } from "next/navigation";
import { pageOwnerVenue } from "@/lib/guard";
import { listRuns } from "@/lib/arena/engine";

export default async function ReportIndex({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const runs = await listRuns(venue.id);
  const latest = runs.find((r) => r.status === "complete") ?? runs[0];
  redirect(latest ? `/app/v/${venue.id}/report/${latest.id}` : `/app/v/${venue.id}/arena`);
}
