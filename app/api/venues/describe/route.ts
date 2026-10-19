import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { describeToTags } from "@/lib/venues";

export const runtime = "nodejs";

const Body = z.object({ text: z.string().min(2).max(600) });

/** Live preview: which Qloo tags a description maps to. */
export const POST = handle(async (req: Request) => {
  await requireUser();
  const { text } = await parseBody(req, Body);
  const { tags, evidence } = await describeToTags(text);
  return json({ tags: tags.map((t) => ({ id: t.id, name: t.name })), evidence: evidence[0] ?? null });
});
