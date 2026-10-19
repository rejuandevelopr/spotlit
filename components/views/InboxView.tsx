"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";
import type { InboxDoc } from "@/lib/types";
import type { InboxStats } from "@/lib/inbox";

const OUTCOME: Record<InboxDoc["outcome"], [string, string, string]> = {
  recommended: ["Recommended", "#F26A3F", "#1A0D08"],
  top3: ["Top 3", "#0B0B0C", "#FFFFFF"],
  answered: ["Answered", "#EDECE7", "#0B0B0C"],
  unknown: ["Unknown", "#FFF0E9", "#A33E1E"],
  lost: ["Lost to rival", "#EDECE7", "#6B6A66"],
};

export function InboxView({
  venueId,
  venueName,
  mcpUrl,
  slug,
  initialItems,
  stats,
  alertsOn,
  readOnly,
}: {
  venueId: string;
  venueName: string;
  mcpUrl: string;
  slug: string;
  initialItems: InboxDoc[];
  stats: InboxStats;
  alertsOn: boolean;
  readOnly: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [alerts, setAlerts] = useState(alertsOn);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const t = setInterval(async () => {
      const r = await fetch(`/api/inbox?venueId=${venueId}`, { cache: "no-store" }).catch(() => null);
      if (!r?.ok || !alive) return;
      const j = (await r.json()) as { items: InboxDoc[] };
      setItems((prev) => {
        const known = new Set(prev.map((p) => p.id));
        const added = j.items.filter((x) => !known.has(x.id)).map((x) => x.id);
        if (added.length) setFresh(new Set(added));
        return j.items;
      });
    }, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [venueId]);

  async function toggleAlerts() {
    const next = !alerts;
    setAlerts(next);
    const me = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ notificationPrefs: { lostRequests: next, weeklyReport: true, runFinished: true } }) });
    if (!me.ok) setAlerts(!next);
  }

  const maxW = Math.max(1, ...stats.weekly.map((w) => w.requests));
  const pts = (key: "requests" | "recommended") =>
    stats.weekly.map((w, i) => `${10 + i * 42},${170 - (w[key] / maxW) * 130}`).join(" ");
  const pctRec = stats.thisWeek ? Math.round((stats.recommended / stats.thisWeek) * 100) : 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="lab text-ash">{venueName} · Agent inbox</span>
          <h1 className="serif m-0 text-[clamp(44px,5vw,68px)] leading-none">
            Agents <em className="text-signal-text">asking</em> about you.
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-relaxed text-ash-2">Real requests from outside assistants that reached your agent over A2A or MCP. Arena simulations are never counted here.</p>
        </div>
        {!readOnly && (
          <button type="button" onClick={toggleAlerts} aria-pressed={alerts} className="inline-flex min-h-12 items-center gap-3 rounded-full border border-line bg-white py-0 pl-3 pr-[18px] text-sm font-semibold">
            <span className={`relative inline-block h-6 w-10 rounded-full ${alerts ? "bg-signal" : "bg-[#A9A79F]"}`}>
              <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: alerts ? 19 : 3 }} />
            </span>
            Notify me when I lose a request
          </button>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat label="Requests this week" value={stats.thisWeek} note={`${stats.lastWeek} last week`} />
        <Stat label="Recommended" value={stats.recommended} note={`${pctRec}% of requests`} accent />
        <Stat label="Answered unknown" value={stats.unknown} note={stats.unknownTopic ? `Mostly about ${stats.unknownTopic}` : "Nothing unknown"} />
        <Stat label="Booking links sent" value={stats.booking} note="From your agent card" />
      </div>
      <div className="flex flex-wrap gap-4">
        <section className="card flex-[3_1_520px] gap-0 px-7 pb-4 pt-2">
          <div className="flex justify-between pb-3 pt-5">
            <span className="lab text-ash">Live requests</span>
            <span className="lab text-[11px] text-signal-text"><span className="pulse-dot">●</span> Live</span>
          </div>
          {items.length === 0 && (
            <div className="flex flex-col gap-3 border-t border-line-soft py-5 text-sm text-ash-2">
              <p className="m-0">No outside agent has asked yet. Connect an assistant and ask it for a venue:</p>
              <pre className="m-0 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-fog">{`claude mcp add --transport http spotlit ${mcpUrl}\n\n# or A2A\ncurl -X POST ${mcpUrl.replace("/api/mcp", `/v/${slug}/a2a`)} \\\n  -H 'content-type: application/json' \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","messageId":"m1","parts":[{"kind":"text","text":"Table for two Friday at 9?"}]}}}'`}</pre>
            </div>
          )}
          {items.map((r) => {
            const [label, bg, fg] = OUTCOME[r.outcome];
            return (
              <div key={r.id} className={`flex flex-wrap items-start gap-4 border-t border-line-soft py-4 ${fresh.has(r.id) ? "fade-in bg-[#FFF8F5]" : ""}`}>
                <span className="lab w-[38px] rounded-md border border-ink px-1.5 py-0.5 text-center text-[10px]">{r.protocol.toUpperCase()}</span>
                <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <span className="text-[15px] leading-normal">&ldquo;{r.request}&rdquo;</span>
                  <span className="text-[13px] text-ash">
                    {r.fromAgent}
                    {r.tool ? ` · ${r.tool}` : ""} · {timeAgo(r.createdAt)}
                  </span>
                  {r.response && <span className="text-[13px] leading-snug text-ash-2">Your agent: {r.response}</span>}
                </div>
                <span className="lab whitespace-nowrap rounded-md px-2 py-1 text-[10px]" style={{ background: bg, color: fg }}>
                  {label}
                </span>
              </div>
            );
          })}
        </section>
        <section className="card flex-[2_1_340px]">
          <span className="lab text-ash">Weekly requests</span>
          <svg viewBox="0 0 320 180" role="img" aria-label="Requests per week over the last eight weeks" className="h-auto w-full">
            <g stroke="#E6E4DE" strokeWidth="1">
              <path d="M0 30 H320" />
              <path d="M0 80 H320" />
              <path d="M0 130 H320" />
              <path d="M0 170 H320" />
            </g>
            <polyline points={pts("requests")} fill="none" stroke="#0B0B0C" strokeWidth="2" />
            <polyline points={pts("recommended")} fill="none" stroke="#F26A3F" strokeWidth="2" />
          </svg>
          <div className="flex flex-wrap gap-5 text-[13px] text-ash-2">
            <span className="flex items-center gap-2"><span className="h-0.5 w-4 bg-ink" />Requests</span>
            <span className="flex items-center gap-2"><span className="h-0.5 w-4 bg-signal" />Recommended</span>
          </div>
          <div className="flex flex-col gap-2.5 border-t border-line-soft pt-4">
            <span className="lab text-[11px] text-ash">Top asks</span>
            {stats.topAsks.length === 0 && <span className="text-sm text-ash">Nothing yet</span>}
            {stats.topAsks.map((a) => (
              <div key={a.label} className="flex justify-between text-sm">
                <span>{a.label}</span>
                <span className="lab text-xs">{a.n}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, note, accent = false }: { label: string; value: number; note: string; accent?: boolean }) {
  return (
    <div className="card gap-1.5">
      <span className="lab text-[11px] text-ash">{label}</span>
      <span className={`serif text-[56px] leading-none ${accent ? "text-signal-text" : ""}`}>{value}</span>
      <span className="text-[13px] text-ash-2">{note}</span>
    </div>
  );
}
