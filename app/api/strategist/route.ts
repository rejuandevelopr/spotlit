import { z } from "zod";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { clientIp, handle, json, parseBody, rateLimit } from "@/lib/api";
import { readableRun } from "@/lib/runAccess";
import { getVenue } from "@/lib/venues";
import { HttpError } from "@/lib/auth";
import { strategistStream } from "@/lib/agents/strategist-chat";
import type { ActionDoc } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  venueId: z.string(),
  runId: z.string(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(12),
});

export const POST = handle(async (req: Request) => {
  if (!rateLimit(`strategist:${clientIp(req)}`, 20, 60_000)) return json({ error: "Too many messages, wait a minute." }, 429);
  const body = await parseBody(req, Body);
  const { run } = await readableRun(body.runId);
  if (run.venueId !== body.venueId) throw new HttpError(400, "Run does not belong to this venue");
  const venue = await getVenue(run.venueId);
  if (!venue) throw new HttpError(404, "Venue not found");
  const actions = (await db().list<ActionDoc>(P.actions(venue.id))).sort((a, b) => a.rank - b.rank);
  return strategistStream(venue, run, actions, body.messages);
});
