import type { Metadata } from "next";
import { CardEditor } from "@/components/views/CardEditor";
import { pageOwnerVenue } from "@/lib/guard";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { latestCard } from "@/lib/venues";
import type { AgentCardDoc } from "@/lib/types";

export const metadata: Metadata = { title: "Agent card" };

export default async function CardPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const card = await latestCard(venue.id);
  const versions = await db().list<AgentCardDoc>(P.cards(venue.id), { orderBy: ["version", "desc"], limit: 20 });
  if (!card) return <p className="text-ash">This venue has no agent card yet.</p>;
  return (
    <CardEditor
      key={card.version}
      venueId={venue.id}
      venueName={venue.name}
      slug={venue.slug}
      claimed={venue.isClaimed}
      card={card}
      versions={versions.map((v) => ({ version: v.version, createdAt: v.createdAt, readiness: v.readiness, note: v.note }))}
      readOnly={false}
    />
  );
}
