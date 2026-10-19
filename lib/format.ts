// Client safe formatting helpers.

export function clamp(n: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, n));
}

export function round(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export function timeAgo(ts: number, nowTs = Date.now()) {
  const s = Math.max(0, Math.round((nowTs - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "S";
}

export function runLabel(n: number) {
  return `Run ${String(n).padStart(2, "0")}`;
}
