// Deterministic randomness so the same seed always produces the same personas.

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = () => number;

export const pick = <T,>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];

export function weightedSample<T>(r: Rand, items: T[], weight: (t: T) => number, k: number): T[] {
  const pool = items.map((it) => ({ it, w: Math.max(0.0001, weight(it)) }));
  const out: T[] = [];
  while (out.length < k && pool.length) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let x = r() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      x -= pool[idx].w;
      if (x <= 0) break;
    }
    out.push(pool[idx].it);
    pool.splice(idx, 1);
  }
  return out;
}

/** Largest remainder allocation of n items across weights, with a minimum per bucket. */
export function allocate(n: number, weights: number[], min = 1): number[] {
  const k = weights.length;
  if (!k) return [];
  const base = Math.min(min, Math.floor(n / k));
  const rest = n - base * k;
  const total = weights.reduce((s, w) => s + w, 0) || 1;
  const exact = weights.map((w) => (w / total) * rest);
  const floor = exact.map(Math.floor);
  let left = rest - floor.reduce((s, x) => s + x, 0);
  const order = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    floor[o.i]++;
    left--;
  }
  return floor.map((x) => x + base);
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
