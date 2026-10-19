import type { Metadata } from "next";
import { RivalsView } from "@/components/views/RivalsView";
import { pageOwnerVenue } from "@/lib/guard";
import { getProfile, listRivals } from "@/lib/venues";

export const metadata: Metadata = { title: "Rivals" };

export default async function RivalsPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { venue } = await pageOwnerVenue(venueId);
  const [rivals, profile] = await Promise.all([listRivals(venue.id), getProfile(venue.id)]);
  return <RivalsView venue={venue} rivals={rivals} profile={profile} base={`/app/v/${venue.id}`} readOnly={false} />;
}
