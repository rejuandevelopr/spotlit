import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, upsertUser } from "@/lib/auth";
import { handle, json, parseBody } from "@/lib/api";
import { listOwnerVenues } from "@/lib/venues";
import { adoptDemoIfOwner } from "@/lib/demo";

export const runtime = "nodejs";

const Body = z.object({ idToken: z.string().min(10).optional(), mock: z.boolean().optional() });

export const POST = handle(async (req: Request) => {
  const body = await parseBody(req, Body);
  const maxAge = env.sessionDays * 24 * 3600;
  const jar = await cookies();
  let uid: string;

  if (env.mock && body.mock) {
    uid = "mock-owner";
    await upsertUser({ uid, name: "Test Owner", email: "owner@example.com", photoURL: null });
    jar.set(SESSION_COOKIE, `mock:${uid}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  } else {
    if (!body.idToken) return json({ error: "Missing ID token" }, 400);
    const decoded = await adminAuth().verifyIdToken(body.idToken, true);
    // Only accept recent sign ins (Firebase recommendation for session cookies).
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) return json({ error: "Recent sign in required" }, 401);
    const cookie = await adminAuth().createSessionCookie(body.idToken, { expiresIn: maxAge * 1000 });
    uid = decoded.uid;
    await upsertUser({
      uid,
      name: (decoded.name as string) || decoded.email?.split("@")[0] || "Owner",
      email: decoded.email ?? "",
      photoURL: (decoded.picture as string) ?? null,
    });
    await adoptDemoIfOwner(uid, decoded.email ?? "");
    jar.set(SESSION_COOKIE, cookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge });
  }

  const venues = await listOwnerVenues(uid);
  return json({ ok: true, redirect: venues.length ? "/app" : "/app/new" });
});

export const DELETE = handle(async () => {
  const jar = await cookies();
  const value = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (value && !env.mock) {
    try {
      const decoded = await adminAuth().verifySessionCookie(value);
      await adminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // Cookie already invalid.
    }
  }
  return json({ ok: true });
});
