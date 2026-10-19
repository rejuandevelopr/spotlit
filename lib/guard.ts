import { notFound, redirect } from "next/navigation";
import { getSessionUser, HttpError, requireUser, type SessionUser } from "@/lib/auth";
import { getVenue } from "@/lib/venues";
import type { Venue } from "@/lib/types";

/** For server components: the signed in user, or a redirect to sign in. */
export async function pageUser(next?: string): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect(`/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return u;
}

/** For owner pages: the venue if the user owns it. */
export async function pageOwnerVenue(venueId: string): Promise<{ user: SessionUser; venue: Venue }> {
  const user = await pageUser(`/app/v/${venueId}`);
  const venue = await getVenue(venueId);
  if (!venue) notFound();
  if (venue.ownerId !== user.uid) redirect(`/app/new/claim/${venueId}`);
  return { user, venue };
}

/** For API routes. */
export async function requireOwner(venueId: string): Promise<{ user: SessionUser; venue: Venue }> {
  const user = await requireUser();
  const venue = await getVenue(venueId);
  if (!venue) throw new HttpError(404, "Venue not found");
  if (venue.ownerId !== user.uid) throw new HttpError(403, "You do not own this venue");
  return { user, venue };
}
