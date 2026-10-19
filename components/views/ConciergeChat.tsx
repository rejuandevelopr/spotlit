"use client";

import Link from "next/link";
import { useState } from "react";
import { OMark } from "@/components/spotlit/Brand";
import type { ConciergeResult } from "@/lib/agents/public-concierge";

const CHIPS = ["Somewhere chill for a date Friday around 9, we love Khruangbin and natural wine, nothing too pricey", "Group of 6 Saturday at 8, we're into house music", "Solo drink after work Wednesday, love Alice Coltrane", "Live jazz Thursday at 9 for two, $$"];

interface Turn { q: string; r: ConciergeResult | null; error?: string }

export function ConciergeChat({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const last = turns[turns.length - 1]?.r ?? null;

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setText("");
    setTurns((t) => [...t, { q, r: null }]);
    try {
      const res = await fetch("/api/concierge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: q }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "The concierge failed");
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, r: j } : x)));
    } catch (e) {
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, error: (e as Error).message } : x)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto box-border flex w-full max-w-[1280px] flex-1 flex-wrap gap-4 px-4 pb-16 pt-4 sm:px-8">
      <section aria-label="Chat" className="flex min-w-0 flex-[999_1_560px] flex-col rounded-[14px] border border-line-dark bg-ink-2">
        <div className="flex flex-1 flex-col gap-6 px-5 pt-7 sm:px-7">
          <div className="flex flex-col items-center gap-2.5 py-4 text-center">
            <OMark size={44} />
            <h1 className="serif m-0 text-[44px] leading-none">Where should we go tonight?</h1>
            <p className="m-0 text-[15px] text-smoke">Tell me what you&apos;re into. I ask the venues&apos; own agents, then pick.</p>
          </div>
          {turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-6">
              <div className="max-w-[520px] self-end rounded-[14px_14px_4px_14px] bg-white px-[18px] py-3.5 text-[15px] leading-normal text-ink">{t.q}</div>
              <div className="flex max-w-[640px] items-start gap-3">
                <OMark size={28} className="mt-1 shrink-0" />
                <div className="flex flex-col gap-3">
                  {!t.r && !t.error && <p className="m-0 text-[15px] text-fog"><span className="pulse-dot">●</span> Resolving your tastes with Qloo and asking venue agents over A2A…</p>}
                  {t.error && <p className="m-0 text-[15px] text-signal">{t.error}</p>}
                  {t.r && <Answer r={t.r} />}
                </div>
              </div>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(text);
          }}
          className="m-5 flex flex-col gap-3 sm:m-7"
        >
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => void ask(c)} disabled={busy} className="max-w-full truncate rounded-full border border-line-dark-2 px-3.5 py-2 text-left text-[13px] text-fog hover:border-white">
                {c.length > 46 ? `${c.slice(0, 44)}…` : c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-[14px] border border-line-dark-2 bg-ink py-2 pl-[18px] pr-2">
            <label htmlFor="ask" className="sr-only">Ask the concierge</label>
            <input id="ask" value={text} onChange={(e) => setText(e.target.value)} placeholder="Describe your night, your taste, your budget" className="min-h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-white outline-none placeholder:text-smoke" />
            <button type="submit" disabled={busy} aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-signal text-signal-ink">→</button>
          </div>
        </form>
      </section>
      <aside aria-label="Agent trace" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 rounded-[14px] border border-line-dark bg-ink-2 p-6">
        <div className="flex justify-between">
          <span className="lab text-[11px] text-smoke">Agents consulted</span>
          <span className="lab text-[11px] text-signal">A2A</span>
        </div>
        {!last && <p className="m-0 text-sm text-smoke">Ask something and the venue agents I talk to show up here, with their scores.</p>}
        <div className="flex flex-col gap-2.5">
          {last?.consulted.map((c, i) => (
            <div key={c.venueId} className={`flex flex-col gap-1.5 rounded-[10px] border p-3.5 ${i === 0 ? "border-signal" : "border-[#2E2E31]"}`}>
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-2 ${i === 0 ? "font-semibold" : ""}`}>
                  <span className={c.isProxy ? "h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-dashed border-mist" : "h-2.5 w-2.5 rounded-[2px] bg-signal"} />
                  {c.name}
                </span>
                <span className={`lab text-[11px] ${i === 0 ? "" : "text-smoke"}`}>{c.score.toFixed(2)}</span>
              </div>
              <span className={`text-[13px] ${i === 0 ? "text-mist" : "text-smoke"}`}>
                taste {c.A.toFixed(2)} · fit {c.C.toFixed(2)} · answer {c.Q.toFixed(2)}
                {c.reply ? ` · ${c.reply.availability === "unknown" ? "hours unknown" : c.reply.availability}` : ""}
                {c.isProxy ? " · public data only" : ""}
              </span>
            </div>
          ))}
        </div>
        {last?.resolvedLikes.length ? (
          <p className="m-0 text-xs text-smoke">Qloo matched your tastes to {last.resolvedLikes.map((x) => x.name).join(", ")}.</p>
        ) : null}
        <p className="mb-0 mt-auto text-xs leading-relaxed text-ash">Scores: 60% Qloo taste affinity, 25% fit for your plan, 15% answer quality. Taste data by Qloo. Recommendations only, never bookings.</p>
      </aside>
    </main>
  );
}

function Answer({ r }: { r: ConciergeResult }) {
  const rec = r.recommendation;
  if (!rec) return <p className="m-0 text-[15px] text-fog">{r.message}</p>;
  const runner = r.consulted[1];
  return (
    <>
      <p className="m-0 text-[15px] leading-relaxed text-fog">
        I asked {r.consulted.length} venue agents. My pick is <strong className="text-white">{rec.name}</strong>
        {rec.reply?.pitch ? `: “${rec.reply.pitch}”` : "."}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] bg-white p-[18px] text-ink">
        <div className="flex flex-col gap-1">
          <span className="lab text-[10px] text-ash">Best match · {rec.score.toFixed(2)}</span>
          <span className="serif text-[28px] leading-none">{rec.name}</span>
          <span className="text-[13px] text-ash">
            {rec.isProxy ? "Unclaimed, public data only" : rec.isFictional ? "Fictional demo venue" : "Claimed venue"}
            {rec.reply?.availability === "open" ? " · Open then" : rec.reply?.availability === "unknown" ? " · Hours not listed" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/v/${rec.slug}`} className="btn btn-sm btn-line">Details</Link>
          {rec.reply?.bookingLink && !rec.isFictional && (
            <a href={rec.reply.bookingLink} target="_blank" rel="noreferrer" className="btn btn-sm btn-ink">Book</a>
          )}
        </div>
      </div>
      {runner && (
        <p className="m-0 text-sm text-smoke">
          Runner up: {runner.name} ({runner.score.toFixed(2)}){runner.reply?.availability === "unknown" ? ", it couldn't confirm hours" : ""}.
        </p>
      )}
    </>
  );
}
