import { redirect } from "next/navigation";

export default async function VenueRoot({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  redirect(`/app/v/${venueId}/dna`);
}
