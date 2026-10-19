import { createHash } from "node:crypto";

/** Minimal promise concurrency limiter (like p-limit). */
export function limiter(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= max) return;
    const run = queue.shift();
    if (run) run();
  };
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
  };
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "venue";
}

export function stableParams(params: Record<string, string | number | boolean | string[] | undefined | null>) {
  const out: Record<string, string> = {};
  for (const k of Object.keys(params).sort()) {
    const v = params[k];
    if (v === undefined || v === null || v === "") continue;
    out[k] = Array.isArray(v) ? v.join(",") : String(v);
  }
  return out;
}

export { clamp, round, timeAgo, pct } from "./format";
