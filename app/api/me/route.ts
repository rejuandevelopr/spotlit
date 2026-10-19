import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { env } from "@/lib/env";
import { handle, json, parseBody } from "@/lib/api";
import { requireUser, SESSION_COOKIE } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase/admin";
import { listOwnerVenues, releaseVenue } from "@/lib/venues";

export const runtime = "nodejs";

const Patch = z.object({
  name: z.string().min(1).max(80).optional(),
  role: z.enum(["owner", "manager", "marketing"]).optional(),
  notificationPrefs: z.object({ lostRequests: z.boolean(), weeklyReport: z.boolean(), runFinished: z.boolean() }).optional(),
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await parseBody(req, Patch);
  const patch: Record<string, unknown> = {};
  if (body.name) patch.name = body.name;
  if (body.role) patch.role = body.role;
  if (body.notificationPrefs) patch.notificationPrefs = body.notificationPrefs;
  if (Object.keys(patch).length) await db().update(P.user(user.uid), patch);
  return json({ ok: true });
});

/** Delete the account: release venues, remove user data, delete the Firebase user. */
export const DELETE = handle(async () => {
  const user = await requireUser();
  for (const v of await listOwnerVenues(user.uid)) await releaseVenue(v.id);
  await db().deleteCollection(P.notifications(user.uid));
  await db().delete(P.user(user.uid));
  if (!env.mock) {
    try {
      await adminAuth().deleteUser(user.uid);
    } catch {
      // The auth record may already be gone.
    }
  }
  (await cookies()).delete(SESSION_COOKIE);
  return json({ ok: true });
});
