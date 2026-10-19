import { after } from "next/server";
import { env } from "@/lib/env";
import { handle, json } from "@/lib/api";
import { getSessionUser, HttpError } from "@/lib/auth";
import { drive, getRun, tick } from "@/lib/arena/engine";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Plays one batch of rounds, then keeps driving the run in the background. Called by the live
 * page when progress stalls (for example after a serverless timeout) or with the internal secret.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ runId: string }> }) => {
  const { runId } = await ctx.params;
  const run = await getRun(runId);
  if (!run) throw new HttpError(404, "Run not found");
  const secretOk = !!env.internalSecret && req.headers.get("x-spotlit-secret") === env.internalSecret;
  if (!secretOk) {
    const user = await getSessionUser();
    if (!user || user.uid !== run.ownerId) throw new HttpError(403, "Not your run");
  }
  if (run.status !== "running") return json({ complete: true });
  if (run.lastTickAt && Date.now() - run.lastTickAt < 8000) return json({ busy: true });
  const r = await tick(runId);
  if (!r.complete) after(async () => void (await drive(runId, 250_000).catch(() => undefined)));
  return json(r);
});
