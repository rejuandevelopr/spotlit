import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { requireOwner } from "@/lib/guard";
import { parseIntent } from "@/lib/agents/intent";
import { venueReply } from "@/lib/agents/venue";
import { latestCard } from "@/lib/venues";

export const runtime = "nodejs";

const Body = z.object({ text: z.string().min(1).max(500) });

/** Test chat on the agent card page. Same agent code as A2A, not logged to the inbox. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { venue } = await requireOwner(id);
  const { text } = await parseBody(req, Body);
  const card = await latestCard(id);
  if (!card) return json({ error: "No card yet" }, 400);
  const reply = await venueReply(venue, card, { text, constraints: parseIntent(text) });
  return json({ reply });
});
