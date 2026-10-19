import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { adminAuth } from "@/lib/firebase/admin";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import type { UserDoc } from "@/lib/types";

export const SESSION_COOKIE = "__session";

export interface SessionUser { uid: string; name: string; email: string; photoURL: string | null }

/** Verify the session cookie. Works in server components and route handlers (Node runtime). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return null;
  if (env.mock) {
    if (!value.startsWith("mock:")) return null;
    const uid = value.slice(5);
    const u = await db().get<UserDoc>(P.user(uid));
    return u ? { uid, name: u.name, email: u.email, photoURL: u.photoURL } : null;
  }
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    return {
      uid: decoded.uid,
      name: (decoded.name as string) || decoded.email?.split("@")[0] || "Owner",
      email: decoded.email ?? "",
      photoURL: (decoded.picture as string) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new HttpError(401, "Sign in required");
  return u;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function upsertUser(u: SessionUser): Promise<{ user: UserDoc; isNew: boolean }> {
  const existing = await db().get<UserDoc>(P.user(u.uid));
  if (existing) {
    await db().update(P.user(u.uid), { name: u.name || existing.name, email: u.email || existing.email, photoURL: u.photoURL ?? existing.photoURL });
    return { user: { ...existing, name: u.name || existing.name }, isNew: false };
  }
  const user: UserDoc = {
    uid: u.uid,
    name: u.name,
    email: u.email,
    photoURL: u.photoURL,
    role: "owner",
    createdAt: Date.now(),
    notificationPrefs: { lostRequests: true, weeklyReport: true, runFinished: true },
  };
  await db().set(P.user(u.uid), { ...user });
  return { user, isNew: true };
}

export const getUserDoc = (uid: string) => db().get<UserDoc>(P.user(uid));
