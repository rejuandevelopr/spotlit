import { handle, json } from "@/lib/api";
import { requireOwner } from "@/lib/guard";
import { buildProfile, findRivals } from "@/lib/venues";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Build (or rebuild) Taste DNA and rivals. Qloo responses are cached, so this is cheap to repeat. */
export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  await requireOwner(id);
  const profile = await buildProfile(id);
  const rivals = await findRivals(id);
  return json({ ok: true, tags: profile.tags.length, rivals: rivals.length });
});
