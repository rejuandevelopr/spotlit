import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import { handle, json } from "@/lib/api";
import { requireUser, HttpError } from "@/lib/auth";
import { getRun } from "@/lib/arena/engine";
import type { ShareDoc } from "@/lib/types";

export const runtime = "nodejs";

/** Create a read only share link for a report. */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ runId: string }> }) => {
  const user = await requireUser();
  const { runId } = await ctx.params;
  const run = await getRun(runId);
  if (!run) throw new HttpError(404, "Run not found");
  if (run.ownerId !== user.uid) throw new HttpError(403, "Not your run");
  const existing = await db().list<ShareDoc>("shares", { where: [["runId", "==", runId]], limit: 1 });
  if (existing[0]) return json({ token: existing[0].token });
  const token = newId(22);
  await db().set(P.share(token), { token, runId, venueId: run.venueId, createdBy: user.uid, createdAt: Date.now() });
  return json({ token });
});
