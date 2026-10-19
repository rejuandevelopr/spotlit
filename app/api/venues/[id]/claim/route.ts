import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { claimVenue } from "@/lib/venues";

export const runtime = "nodejs";

const Body = z.object({ role: z.enum(["owner", "manager", "marketing"]), authorized: z.literal(true) });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const body = await parseBody(req, Body);
  const r = await claimVenue(id, user.uid, body.role);
  if (r === "not_found") throw new HttpError(404, "Venue not found");
  if (r === "already_claimed") return json({ error: "already_claimed" }, 409);
  return json({ ok: true });
});
