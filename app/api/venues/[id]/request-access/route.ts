import { handle, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getVenue } from "@/lib/venues";
import { notify } from "@/lib/notifications";

export const runtime = "nodejs";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const venue = await getVenue(id);
  if (!venue) throw new HttpError(404, "Venue not found");
  if (!venue.ownerId || venue.ownerId === user.uid) return json({ ok: true });
  await notify(venue.ownerId, {
    kind: "access_request",
    title: `${user.name} asked for access to ${venue.name}`,
    body: `${user.email || "A Spotlit user"} says they manage ${venue.name}. Reply to them directly if that is right.`,
    link: "/app",
  });
  return json({ ok: true });
});
