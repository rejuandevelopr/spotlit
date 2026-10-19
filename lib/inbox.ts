import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { parseIntent } from "@/lib/agents/intent";
import { DAY_LABEL, type InboxDoc } from "@/lib/types";

const WEEK = 7 * 24 * 3600 * 1000;

export interface InboxStats {
  thisWeek: number;
  lastWeek: number;
  recommended: number;
  unknown: number;
  unknownTopic: string | null;
  booking: number;
  weekly: { requests: number; recommended: number }[];
  topAsks: { label: string; n: number }[];
}

export async function inboxItems(venueId: string, limit = 30) {
  return db().list<InboxDoc>(P.inbox(venueId), { orderBy: ["createdAt", "desc"], limit });
}

export function sanitize(items: InboxDoc[]): InboxDoc[] {
  return items.map((i) => ({
    ...i,
    request: i.request.replace(/https?:\/\/\S+/g, "[link]").replace(/\S+@\S+\.\S+/g, "[email]").slice(0, 160),
    response: i.response.slice(0, 200),
  }));
}

function askLabel(text: string) {
  if (/^(find_venue_for_taste|ask_venue|get_taste_dna)/.test(text)) return text.split(":")[0].replace(/_/g, " ");
  const i = parseIntent(text);
  const parts = [i.occasion ? i.occasion[0].toUpperCase() + i.occasion.slice(1) : null, i.day ? DAY_LABEL[i.day] : null].filter(Boolean);
  if (i.partySize && i.partySize >= 6) parts.push("groups of 6 or more");
  return parts.length ? parts.join(", ") : "General questions";
}

export async function inboxStats(venueId: string): Promise<InboxStats> {
  const since = Date.now() - 8 * WEEK;
  const items = await db().list<InboxDoc>(P.inbox(venueId), { where: [["createdAt", ">=", since]] });
  const now = Date.now();
  const thisWeek = items.filter((i) => now - i.createdAt < WEEK);
  const lastWeek = items.filter((i) => now - i.createdAt >= WEEK && now - i.createdAt < 2 * WEEK);
  const weekly = Array.from({ length: 8 }, (_, k) => {
    const lo = now - (8 - k) * WEEK;
    const hi = lo + WEEK;
    const w = items.filter((i) => i.createdAt >= lo && i.createdAt < hi);
    return { requests: w.length, recommended: w.filter((i) => i.outcome === "recommended").length };
  });
  const unknown = thisWeek.filter((i) => i.outcome === "unknown");
  const topicCounts = new Map<string, number>();
  for (const u of unknown) {
    const d = parseIntent(u.request).day;
    const k = d ? `${DAY_LABEL[d]} hours` : "hours or prices";
    topicCounts.set(k, (topicCounts.get(k) ?? 0) + 1);
  }
  const asks = new Map<string, number>();
  for (const i of items) {
    const l = askLabel(i.request);
    asks.set(l, (asks.get(l) ?? 0) + 1);
  }
  return {
    thisWeek: thisWeek.length,
    lastWeek: lastWeek.length,
    recommended: thisWeek.filter((i) => i.outcome === "recommended").length,
    unknown: unknown.length,
    unknownTopic: [...topicCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    booking: thisWeek.filter((i) => /book at|booking/i.test(i.response)).length,
    weekly,
    topAsks: [...asks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([label, n]) => ({ label, n })),
  };
}
