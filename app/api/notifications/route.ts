import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listNotifications, markAllRead } from "@/lib/notifications";

export const runtime = "nodejs";

export const GET = handle(async () => {
  const user = await requireUser();
  return json({ items: await listNotifications(user.uid, 20) });
});

/** Mark all as read. */
export const POST = handle(async () => {
  const user = await requireUser();
  await markAllRead(user.uid);
  return json({ ok: true });
});
