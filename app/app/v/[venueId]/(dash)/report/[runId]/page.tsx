import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ReportView } from "@/components/views/ReportView";
import { pageOwnerVenue } from "@/lib/guard";
import { getRun } from "@/lib/arena/engine";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import type { RoundDoc } from "@/lib/types";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ venueId: string; runId: string }> }) {
  const { venueId, runId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const run = await getRun(runId);
  if (!run || run.venueId !== venue.id) notFound();
  const first = (await db().list<RoundDoc>(P.rounds(run.id), { orderBy: ["index", "asc"], limit: 1 }))[0];
  return <ReportView venue={venue} run={run} evidence={first?.affinityEvidence ?? null} base={`/app/v/${venue.id}`} readOnly={false} canShare />;
}
