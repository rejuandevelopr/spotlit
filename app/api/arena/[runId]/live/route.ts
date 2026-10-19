import { handle, json } from "@/lib/api";
import { readableRun } from "@/lib/runAccess";
import { livePayload } from "@/lib/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, ctx: { params: Promise<{ runId: string }> }) => {
  const { runId } = await ctx.params;
  const { run } = await readableRun(runId);
  const all = new URL(req.url).searchParams.get("all") === "1";
  return json(await livePayload(run, { all }));
});
