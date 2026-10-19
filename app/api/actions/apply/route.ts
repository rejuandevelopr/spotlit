import { after } from "next/server";
import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { requireOwner } from "@/lib/guard";
import { applyActions } from "@/lib/agents/strategist";
import { createRun, drive, getRun } from "@/lib/arena/engine";
import { HttpError } from "@/lib/auth";
import { assertRunQuota } from "@/lib/runQuota";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  venueId: z.string(),
  parentRunId: z.string(),
  actionIds: z.array(z.string()).min(1).max(5),
  overrides: z.record(z.object({ booking: z.string().max(300).optional() })).default({}),
});

/** Apply accepted fixes as a new card version, then re-run the same personas (what-if). */
export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, Body);
  const { user } = await requireOwner(body.venueId);
  await assertRunQuota(user);
  const parent = await getRun(body.parentRunId);
  if (!parent || parent.venueId !== body.venueId) throw new HttpError(404, "Run not found");
  for (const o of Object.values(body.overrides)) {
    if (o.booking !== undefined && o.booking && !/^https?:\/\//.test(o.booking)) throw new HttpError(400, "The booking link must start with http");
  }
  const { applied } = await applyActions(body.venueId, body.actionIds, body.overrides);
  if (!applied.length) return json({ ok: true, runId: null });
  const run = await createRun({ venueId: body.venueId, ownerId: user.uid, label: "what-if", parentRunId: parent.id, appliedActionIds: applied });
  after(async () => void (await drive(run.id, 270_000).catch((e) => console.error("[what-if] drive failed", e))));
  return json({ ok: true, runId: run.id });
});
