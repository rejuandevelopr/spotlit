import { handle, json } from "@/lib/api";
import { getSessionUser, HttpError } from "@/lib/auth";
import { getVenue } from "@/lib/venues";
import { getDemoMeta } from "@/lib/demo";
import { inboxItems, sanitize } from "@/lib/inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Live inbox list. Owners see everything; the public demo venue's inbox is readable, lightly sanitized. */
export const GET = handle(async (req: Request) => {
  const venueId = new URL(req.url).searchParams.get("venueId") ?? "";
  const venue = await getVenue(venueId);
  if (!venue) throw new HttpError(404, "Venue not found");
  const user = await getSessionUser();
  const isOwner = !!user && user.uid === venue.ownerId;
  const demo = await getDemoMeta();
  if (!isOwner && demo?.venueId !== venue.id) throw new HttpError(403, "Not your venue");
  const items = await inboxItems(venue.id, 30);
  return json({ items: isOwner ? items : sanitize(items) });
});
