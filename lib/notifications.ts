import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import type { NotificationDoc, UserDoc } from "@/lib/types";

const PREF_FOR: Partial<Record<NotificationDoc["kind"], keyof UserDoc["notificationPrefs"]>> = {
  lost_request: "lostRequests",
  run_finished: "runFinished",
  weekly: "weeklyReport",
};

export async function notify(uid: string | null | undefined, n: Omit<NotificationDoc, "id" | "read" | "createdAt">) {
  if (!uid) return;
  try {
    const user = await db().get<UserDoc>(P.user(uid));
    const pref = PREF_FOR[n.kind];
    if (user && pref && user.notificationPrefs && user.notificationPrefs[pref] === false) return;
    const id = newId(16);
    await db().set(P.notification(uid, id), { ...n, id, read: false, createdAt: Date.now() });
  } catch (err) {
    console.warn("[notify] failed", (err as Error).message);
  }
}

export async function listNotifications(uid: string, limit = 20) {
  return db().list<NotificationDoc>(P.notifications(uid), { orderBy: ["createdAt", "desc"], limit });
}

export async function markAllRead(uid: string) {
  const rows = await db().list<NotificationDoc>(P.notifications(uid), { where: [["read", "==", false]] });
  await Promise.all(rows.map((r) => db().update(P.notification(uid, r.id), { read: true })));
}
