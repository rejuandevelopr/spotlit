"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { OMark } from "@/components/spotlit/Brand";
import { Busy } from "@/components/spotlit/Loading";
import { fmtClock } from "@/lib/format";
import type { LivePayload, LiveRound } from "@/lib/live";

interface Props {
  runId: string;
  initial: LivePayload;
  backHref: string;
  reportHref: string;
  mode: "live" | "replay";
}

/** Dark arena theatre: personas on the left, the concierge in the middle, venue agents on the right. */
export function ArenaTheatre({ runId, initial, backHref, reportHref, mode }: Props) {
  const [data, setData] = useState<LivePayload>(initial);
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState(mode === "replay" ? 0 : -1);
  const nudged = useRef(0);

  // Live: poll progress and nudge the worker if it stalls.
  useEffect(() => {
    if (mode !== "live") return;
    let alive = true;
    const poll = async () => {
      if (paused) return;
      try {
        const r = await fetch(`/api/arena/${runId}/live`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as LivePayload;
        if (!alive) return;
        setData(j);
        const stale = !j.run.lastTickAt || Date.now() - j.run.lastTickAt > 25000;
        if (j.run.status === "running" && stale && Date.now() - nudged.current > 20000) {
          nudged.current = Date.now();
          void fetch(`/api/arena/${runId}/tick`, { method: "POST" });
        }
      } catch {
        // Network blip: try again next tick.
      }
    };
    void poll();
    const t = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [mode, runId, paused]);

  // Replay: step through the finished rounds in order.
  const ordered = useMemo(() => [...initial.rounds].sort((a, b) => a.index - b.index), [initial.rounds]);
  useEffect(() => {
    if (mode !== "replay" || paused) return;
    const t = setInterval(() => setCursor((c) => (c + 1 > ordered.length ? c : c + 1)), 650);
    return () => clearInterval(t);
  }, [mode, paused, ordered.length]);

  const shown: LiveRound[] = mode === "replay" ? ordered.slice(0, cursor).reverse() : data.rounds;
  const current = shown[0] ?? null;
  const total = data.run.progress.total;
  const done = mode === "replay" ? Math.min(cursor, ordered.length) : data.run.progress.done;
  const wins = mode === "replay" ? ordered.slice(0, cursor).filter((r) => r.targetWon).length : data.run.wins;
  const complete = mode === "replay" ? cursor >= ordered.length : data.run.status === "complete";
  const target = data.venues.find((v) => v.isTarget);

  const personas = shown.slice(0, 9);
  // Your venue sits in the middle of the venue column.
  const venues = useMemo(() => {
    const rest = data.venues.filter((v) => !v.isTarget);
    const mid = Math.floor(rest.length / 2);
    return [...rest.slice(0, mid), ...(target ? [target] : []), ...rest.slice(mid)];
  }, [data.venues, target]);
  const scoreOf = (venueId: string) => current?.candidates.find((c) => c.venueId === venueId);

  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line-dark px-4 py-4 sm:px-10">
        <div className="flex flex-wrap items-center gap-5">
          <Link href={backHref} aria-label="Back to dashboard" className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-[#2E2E31] text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </Link>
          <div className="flex flex-col gap-0.5">
            <span className="lab text-[11px] text-smoke">
              {data.run.venueName} · Run {String(data.run.number).padStart(2, "0")} · {data.run.label === "what-if" ? "What if" : "Baseline"}
            </span>
            <span className="serif text-[30px] leading-none">Agent Arena</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="lab rounded-full border border-[#5A2A1A] px-3 py-1.5 text-[11px] text-signal">
            {complete ? "Complete" : mode === "replay" ? "▶ Replay" : <><span className="pulse-dot">●</span> Live</>}
          </span>
          <span className="lab text-[11px] text-smoke">
            Seed {data.run.seed % 10000} · {data.run.personaCount} personas · {venues.length} venues · simulation
          </span>
          {!complete && (
            <button type="button" onClick={() => setPaused((p) => !p)} className="btn btn-sm btn-line-dark">
              {paused ? "Resume" : "Pause"}
            </button>
          )}
          {complete && (
            <Link href={reportHref} className="btn btn-sm btn-signal">See the report</Link>
          )}
        </div>
      </header>
      <div className="px-4 sm:px-10">
        <div className="flex flex-wrap justify-between gap-4 pb-2.5 pt-4">
          <span className="lab text-[11px] text-mist">
            {done} of {total} rounds
          </span>
          <span className="lab text-[11px] text-mist">
            {target?.name ?? "Your venue"} wins so far: {wins}
          </span>
        </div>
        <div className="h-1 rounded-full bg-line-dark">
          <div className="h-1 rounded-full bg-signal transition-all duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </div>
      <main className="flex flex-1 flex-wrap gap-4 px-4 pb-8 pt-5 sm:px-10">
        <section aria-label="Arena theatre" className="relative min-h-[620px] min-w-0 flex-[999_1_640px] overflow-hidden rounded-[14px] border border-line-dark bg-[#0F0F11]">
          <div className="lab absolute left-6 top-5 text-[10px] text-ash">Personas</div>
          <div className="lab absolute left-1/2 top-5 -translate-x-1/2 text-[10px] text-ash">Concierge</div>
          <div className="lab absolute right-6 top-5 text-[10px] text-ash">Venue agents</div>
          <svg viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
            <g stroke="#1F1F22" strokeWidth="1" fill="none">
              {personas.map((_, i) => (
                <path key={i} d={`M110 ${90 + i * 60} L500 310`} />
              ))}
              {venues.map((_, i) => (
                <path key={i} d={`M500 310 L860 ${venueY(i, venues.length) * 6.2}`} />
              ))}
            </g>
            {current && <path d="M110 90 L500 310" stroke="#F26A3F" strokeWidth="1.5" fill="none" className="dash-flow" />}
            {current &&
              venues.map((v, i) => {
                const c = scoreOf(v.id);
                if (!c?.asked) return null;
                const won = current.winner === v.name;
                return (
                  <path
                    key={v.id}
                    d={`M500 310 L860 ${venueY(i, venues.length) * 6.2}`}
                    stroke={won ? "#F26A3F" : "#5A5A5E"}
                    strokeWidth={won ? 2 : 1.2}
                    fill="none"
                    strokeDasharray={won ? undefined : "4 6"}
                  />
                );
              })}
          </svg>
          {personas.map((p, i) => {
            const active = i === 0;
            return (
              <div key={p.id}>
                <span
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: "11%",
                    top: `${14.5 + i * 9.7}%`,
                    width: active ? 16 : 10,
                    height: active ? 16 : 10,
                    background: active ? "#fff" : i < 3 ? "#B9B8B3" : "#5A5A5E",
                    boxShadow: active ? "0 0 0 6px rgba(242,106,63,.3)" : undefined,
                  }}
                />
                <span className="absolute hidden -translate-y-1/2 whitespace-nowrap text-xs sm:block" style={{ left: "calc(11% + 18px)", top: `${14.5 + i * 9.7}%`, color: active ? "#fff" : "#6B6A66" }}>
                  {p.who} · {p.occasion}
                </span>
              </div>
            );
          })}
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3">
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-line-dark-2 bg-ink" style={{ boxShadow: "0 0 0 14px rgba(242,106,63,.06), 0 0 0 30px rgba(242,106,63,.03)" }}>
              <OMark size={68} />
            </div>
            <div className="max-w-[260px] rounded-[10px] border border-[#2E2E31] bg-ink-3 px-3.5 py-2.5 text-center text-[13px] leading-normal text-fog">
              {current ? `“${current.request}”` : complete ? "All rounds played." : <Busy label="Waiting for the first persona…" />}
            </div>
            <span className="lab text-[10px] text-signal">
              {current ? `Asked ${current.candidates.filter((c) => c.asked).length} venue agents over A2A` : "Starting"}
            </span>
          </div>
          {venues.map((v, i) => {
            const c = scoreOf(v.id);
            const me = v.isTarget;
            const won = current?.winner === v.name;
            return (
              <div
                key={v.id}
                className="absolute right-3 flex -translate-y-1/2 items-center gap-2.5 rounded-[10px] border px-3 py-2 sm:right-6"
                style={{ top: `${venueY(i, venues.length)}%`, background: me ? "#1F120D" : "#131315", borderColor: won ? "#F26A3F" : me ? "#5A2A1A" : "#232325" }}
              >
                <span
                  className="h-3.5 w-3.5 rounded-[3px]"
                  style={me ? { background: "#F26A3F" } : { border: "1.5px dashed #8E8D88" }}
                />
                <span className="max-w-[140px] truncate text-[13px]" style={{ color: me ? "#fff" : "#B9B8B3", fontWeight: me ? 600 : 400 }}>
                  {v.name}
                </span>
                <span className="lab text-[10px] text-smoke">{c?.asked ? c.score.toFixed(2) : "·"}</span>
              </div>
            );
          })}
          <div className="absolute bottom-5 left-6 flex flex-wrap gap-5 text-xs text-smoke">
            <span className="flex items-center gap-2"><span className="h-0.5 w-[18px] bg-signal" />Winning reply</span>
            <span className="flex items-center gap-2"><span className="w-[18px] border-t-[1.5px] border-dashed border-[#5A5A5E]" />Other replies</span>
            <span>Score = 0.6 taste + 0.25 fit + 0.15 answer</span>
          </div>
        </section>
        <aside aria-label="Verdicts" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[14px] border border-line-dark bg-ink-2 p-5">
          <span className="lab text-[11px] text-smoke">Verdicts</span>
          <div className="flex max-h-[560px] flex-col gap-2.5 overflow-y-auto text-[13px]" aria-live="polite">
            {shown.length === 0 && <p className="m-0 text-smoke">Rounds appear here as the concierge decides.</p>}
            {shown.slice(0, 24).map((r) => (
              <div key={r.id} className="flex flex-col gap-1 border-b border-line-dark pb-2.5 fade-in">
                <div className="flex flex-wrap items-center gap-2">
                  {r.finishedAt && <span className="lab text-[10px] text-ash">{fmtClock(r.finishedAt)}</span>}
                  <span className="text-fog">{r.who} · {r.occasion}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={r.targetWon ? "font-semibold text-white" : "text-smoke"}>→ {r.winner}</span>
                  {r.codes[0] && <span className="lab rounded-md border border-[#5A2A1A] px-1.5 py-0.5 text-[10px] text-signal">{r.codes[0]}</span>}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

function venueY(i: number, n: number) {
  if (n <= 1) return 50;
  return 16 + (i * (84 - 16)) / (n - 1);
}
