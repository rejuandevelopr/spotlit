import { env } from "@/lib/env";
import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import { limiter, sha256, sleep, stableParams } from "@/lib/util";
import type { Evidence, QlooCallDoc } from "@/lib/types";
import { mockQloo } from "./mock";
import { resultCount, trimResponse } from "./parse";

export class QlooError extends Error {
  constructor(message: string, public status: number, public path: string) {
    super(message);
  }
}
export class CacheMissError extends Error {
  constructor(public path: string) {
    super(`DEMO_MODE is on and this Qloo query is not cached: ${path}`);
  }
}

export interface QlooContext { runId?: string | null; venueId?: string | null; noTrace?: boolean }
export interface QlooResult<T = unknown> { data: T; evidence: Evidence; cached: boolean }

const TTL_MS = 7 * 24 * 3600 * 1000;
const limit = limiter(4);

// Per instance memory cache in front of the database cache.
const g = globalThis as unknown as { __qlooMem?: Map<string, { at: number; data: unknown }> };
const mem = (g.__qlooMem ??= new Map());

type ParamValue = string | number | boolean | string[] | undefined | null;

export function qlooUrl(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return `${env.qlooBase}${path}${qs ? `?${qs}` : ""}`;
}

async function fetchLive(path: string, params: Record<string, string>): Promise<{ status: number; body: unknown }> {
  if (env.mock) return mockQloo(path, params);
  if (!env.qlooKey) throw new QlooError("QLOO_API_KEY is not set", 401, path);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(qlooUrl(path, params), {
        headers: { "X-Api-Key": env.qlooKey, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new QlooError(`Qloo ${res.status}`, res.status, path);
        await sleep(400 * 2 ** attempt + Math.random() * 300);
        continue;
      }
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    } catch (err) {
      lastErr = err;
      await sleep(400 * 2 ** attempt + Math.random() * 300);
    }
  }
  throw lastErr instanceof Error ? lastErr : new QlooError("Qloo request failed", 503, path);
}

async function trace(doc: Omit<QlooCallDoc, "id">): Promise<string> {
  const id = newId(16);
  try {
    await db().set(P.qlooCall(id), { ...doc, id });
  } catch {
    // Tracing must never break the product.
  }
  return id;
}

/**
 * GET a Qloo endpoint with caching, retries, concurrency limits and a trace record.
 * Every call returns evidence that the UI links to.
 */
export async function qlooGet<T = unknown>(
  path: string,
  rawParams: Record<string, ParamValue>,
  ctx: QlooContext = {},
): Promise<QlooResult<T>> {
  const params = stableParams(rawParams);
  const key = sha256(`${env.mock ? "mock:" : ""}${path}?${JSON.stringify(params)}`);
  const started = Date.now();

  let data: unknown = null;
  let cached = false;
  let status = 200;

  const m = mem.get(key);
  if (m && Date.now() - m.at < TTL_MS) {
    data = m.data;
    cached = true;
  } else {
    const row = await db()
      .get<{ json: string; fetchedAt: number }>(P.qlooCache(key))
      .catch(() => null);
    if (row && (env.demoMode || Date.now() - row.fetchedAt < TTL_MS)) {
      data = JSON.parse(row.json);
      cached = true;
      mem.set(key, { at: row.fetchedAt, data });
    }
  }

  if (!cached) {
    if (env.demoMode) throw new CacheMissError(path);
    const res = await limit(() => fetchLive(path, params));
    status = res.status;
    if (res.status >= 400) {
      await trace({ path, params, ms: Date.now() - started, cached: false, status, resultCount: 0, createdAt: Date.now(), runId: ctx.runId ?? null, venueId: ctx.venueId ?? null });
      const msg = typeof res.body === "object" && res.body ? JSON.stringify(res.body).slice(0, 300) : "error";
      throw new QlooError(`Qloo ${res.status} on ${path}: ${msg}`, res.status, path);
    }
    data = trimResponse(res.body);
    mem.set(key, { at: Date.now(), data });
    const json = JSON.stringify(data);
    if (json.length < 900_000) {
      await db()
        .set(P.qlooCache(key), { path, params, json, fetchedAt: Date.now() })
        .catch(() => undefined);
    }
  }

  const callId = ctx.noTrace
    ? "untraced"
    : await trace({
        path,
        params,
        ms: Date.now() - started,
        cached,
        status,
        resultCount: resultCount(data),
        createdAt: Date.now(),
        runId: ctx.runId ?? null,
        venueId: ctx.venueId ?? null,
      });

  return { data: data as T, evidence: { callId, path, params }, cached };
}

/** curl command for the evidence drawer. The key is never included. */
export function curlFor(path: string, params: Record<string, string>) {
  return `curl -G "${env.qlooBase}${path}" -H "X-Api-Key: $QLOO_API_KEY" ${Object.entries(params)
    .map(([k, v]) => `--data-urlencode "${k}=${v}"`)
    .join(" ")}`;
}
