import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/spotlit/PublicHeader";
import { ReportView } from "@/components/views/ReportView";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { getRun } from "@/lib/arena/engine";
import { getVenue } from "@/lib/venues";
import type { ShareDoc } from "@/lib/types";

export const metadata: Metadata = { title: "Shared report", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Read only report for anyone with the link. Rendered on the server with the Admin SDK. */
export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await db().get<ShareDoc>(P.share(token));
  if (!share) notFound();
  const [run, venue] = await Promise.all([getRun(share.runId), getVenue(share.venueId)]);
  if (!run || !venue) notFound();
  return (
    <div className="min-h-screen bg-stone text-ink">
      <PublicHeader />
      <main className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pb-24 pt-8 sm:px-8">
        <div className="rounded-xl border border-dashed border-[#A9A79F] px-4 py-3 text-[13px] text-ash-2">
          Shared read only report for <strong className="text-ink">{venue.name}</strong>. Agent Arena results are a simulation.
        </div>
        <ReportView venue={venue} run={run} evidence={null} base={null} readOnly canShare={false} />
      </main>
    </div>
  );
}
