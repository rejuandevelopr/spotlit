import { NextResponse } from "next/server";
import { ZodError, type z } from "zod";
import { HttpError } from "@/lib/auth";
import { CacheMissError, QlooError } from "@/lib/qloo/client";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  return schema.parse(raw);
}

/** Wrap a route handler with consistent error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      if (err instanceof ZodError) return json({ error: "Invalid input", issues: err.issues.slice(0, 5) }, 400);
      if (err instanceof CacheMissError) return json({ error: "This data is not cached yet and the app is in demo mode." }, 503);
      if (err instanceof QlooError) return json({ error: `Qloo request failed (${err.status}). Try again in a moment.` }, 502);
      console.error("[api]", err);
      return json({ error: (err as Error)?.message || "Something went wrong" }, 500);
    }
  };
}

// Tiny fixed window rate limiter per instance (good enough for public endpoints).
const g = globalThis as unknown as { __rl?: Map<string, { n: number; at: number }> };
const buckets = (g.__rl ??= new Map());

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const nowTs = Date.now();
  const b = buckets.get(key);
  if (!b || nowTs - b.at > windowMs) {
    buckets.set(key, { n: 1, at: nowTs });
    return true;
  }
  b.n++;
  return b.n <= max;
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
