import { after } from "next/server";
import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { requireOwner } from "@/lib/guard";
import { createRun, drive } from "@/lib/arena/engine";
import { latestCard } from "@/lib/venues";
import { HttpError } from "@/lib/auth";
import { assertRunQuota } from "@/lib/runQuota";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ venueId: z.string().min(1), personaCount: z.number().int().min(6).max(60).optional() });

/** Start a baseline run. Rounds are played in the background and the live page polls progress. */
export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, Body);
  const { user } = await requireOwner(body.venueId);
  await assertRunQuota(user);
  const card = await latestCard(body.venueId);
  if (!card) throw new HttpError(400, "Publish an agent card first");
  const run = await createRun({ venueId: body.venueId, ownerId: user.uid, label: "baseline", personaCount: body.personaCount });
  after(async () => {
    await drive(run.id, 270_000).catch((err) => console.error("[arena] drive failed", err));
  });
  return json({ runId: run.id });
});
