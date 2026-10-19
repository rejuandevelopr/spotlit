import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { requireOwner } from "@/lib/guard";
import { saveCard } from "@/lib/venues";
import { CardFactsSchema } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.object({ facts: CardFactsSchema, voice: z.string().max(800) });

/** Publish a new agent card version. */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireOwner(id);
  const body = await parseBody(req, Body);
  const card = await saveCard(id, body.facts, body.voice, "Edited by owner");
  return json({ ok: true, version: card.version, readiness: card.readiness });
});
