import { z } from "zod";
import { clientIp, handle, json, parseBody, rateLimit } from "@/lib/api";
import { runConcierge } from "@/lib/agents/public-concierge";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({ text: z.string().min(3).max(500), city: z.string().max(80).optional() });

/** Public consumer concierge. Rate limited per IP. */
export const POST = handle(async (req: Request) => {
  if (!rateLimit(`concierge:${clientIp(req)}`, 8, 60_000)) return json({ error: "The concierge is busy. Try again in a minute." }, 429);
  const body = await parseBody(req, Body);
  const r = await runConcierge({ text: body.text, city: body.city ?? null }, { fromAgent: "Spotlit public concierge", protocol: "a2a" });
  return json(r);
});
