import type { Metadata } from "next";
import { DnaView } from "@/components/views/DnaView";
import { pageOwnerVenue } from "@/lib/guard";
import { getProfile, latestCard, listRivals } from "@/lib/venues";

export const metadata: Metadata = { title: "Taste DNA" };

export default async function DnaPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const [profile, card, rivals] = await Promise.all([getProfile(venue.id), latestCard(venue.id), listRivals(venue.id)]);
  return <DnaView venue={venue} profile={profile} card={card} rivals={rivals} base={`/app/v/${venue.id}`} readOnly={false} />;
}
