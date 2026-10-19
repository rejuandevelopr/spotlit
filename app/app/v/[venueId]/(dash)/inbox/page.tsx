import type { Metadata } from "next";
import { InboxView } from "@/components/views/InboxView";
import { pageOwnerVenue } from "@/lib/guard";
import { getUserDoc } from "@/lib/auth";
import { inboxItems, inboxStats } from "@/lib/inbox";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Agent inbox" };
export const dynamic = "force-dynamic";

export default async function InboxPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { user, venue } = await pageOwnerVenue(venueId);
  const [items, stats, doc] = await Promise.all([inboxItems(venue.id, 30), inboxStats(venue.id), getUserDoc(user.uid)]);
  return (
    <InboxView
      venueId={venue.id}
      venueName={venue.name}
      slug={venue.slug}
      mcpUrl={`${env.appUrl}/api/mcp`}
      initialItems={items}
      stats={stats}
      alertsOn={doc?.notificationPrefs.lostRequests ?? true}
      readOnly={false}
    />
  );
}
