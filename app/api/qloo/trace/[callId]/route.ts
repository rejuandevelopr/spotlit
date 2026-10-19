import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { handle, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { curlFor, qlooUrl } from "@/lib/qloo/client";
import type { QlooCallDoc } from "@/lib/types";

export const runtime = "nodejs";

/** Evidence drawer: the exact Qloo query behind a number. Contains no secrets. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ callId: string }> }) => {
  const { callId } = await ctx.params;
  const doc = await db().get<QlooCallDoc>(P.qlooCall(callId));
  if (!doc) throw new HttpError(404, "Trace not found");
  return json({
    path: doc.path,
    params: doc.params,
    ms: doc.ms,
    cached: doc.cached,
    status: doc.status,
    resultCount: doc.resultCount,
    createdAt: doc.createdAt,
    curl: curlFor(doc.path, doc.params),
    url: qlooUrl(doc.path, doc.params),
  });
});
