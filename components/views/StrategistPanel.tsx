"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { OMark } from "@/components/spotlit/Brand";
import { EvidenceLink } from "@/components/spotlit/EvidenceLink";
import type { ActionDoc, Segment } from "@/lib/types";
import { LoadingSteps } from "@/components/spotlit/Loading";

const KIND: Record<ActionDoc["kind"], string> = {
  card_fact: "Card fact",
  pitch: "Pitch",
  event: "Event",
  menu: "Menu",
  hours: "Hours",
  collab: "Collab",
};

interface Msg { role: "user" | "assistant"; content: string }

export function StrategistPanel({
  venueId,
  runId,
  runNumber,
  actions,
  segments,
  opener,
  readOnly,
}: {
  venueId: string;
  runId: string;
  runNumber: number;
  actions: ActionDoc[];
  segments: Pick<Segment, "id" | "name" | "seedPool" | "evidence">[];
  opener: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(actions.map((a) => [a.id, a.status === "accepted" || a.status === "applied" || (a.status === "proposed" && a.liftType === "measured")])),
  );
  const [booking, setBooking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", content: opener }]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const acceptedIds = actions.filter((a) => accepted[a.id] && a.status !== "applied").map((a) => a.id);
  const measuredCount = actions.filter((a) => accepted[a.id] && a.liftType === "measured" && a.status !== "applied").length;
  const needsBooking = actions.some((a) => accepted[a.id] && a.status !== "applied" && "booking" in a.patch && !a.patch.booking);

  async function rerun() {
    setBusy(true);
    setError(null);
    const overrides: Record<string, { booking?: string }> = {};
    for (const a of actions) if (accepted[a.id] && "booking" in a.patch) overrides[a.id] = { booking: booking.trim() };
    const r = await fetch("/api/actions/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ venueId, parentRunId: runId, actionIds: acceptedIds, overrides }),
    });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not apply the fixes");
      setBusy(false);
      return;
    }
    if (j.runId) router.push(`/app/v/${venueId}/arena/${j.runId}`);
    else {
      setBusy(false);
      router.refresh();
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    try {
      const r = await fetch("/api/strategist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ venueId, runId, messages: next.slice(-10) }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "The strategist is unavailable");
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMsgs([...next, { role: "assistant", content: acc }]);
        endRef.current?.scrollIntoView({ block: "nearest" });
      }
    } catch (err) {
      setMsgs([...next, { role: "assistant", content: (err as Error).message }]);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="lab text-ash">Growth Strategist · Run {String(runNumber).padStart(2, "0")}</span>
          <h1 className="serif m-0 text-[clamp(44px,5vw,68px)] leading-none">
            {numberWord(actions.length)} {actions.length === 1 ? "move" : "moves"} to get <em className="text-signal-text">picked</em>.
          </h1>
        </div>
        {!readOnly && (
          <button type="button" onClick={rerun} disabled={busy || !acceptedIds.length || (needsBooking && !/^https?:\/\//.test(booking.trim()))} className="btn btn-signal">
            {busy ? <LoadingSteps every={4000} steps={["Applying fixes to your agent card…", "Publishing the new card version…", "Starting the what if run…"]} /> : measuredCount ? `Re-run with ${measuredCount} accepted` : "Save accepted ideas"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="m-0 text-sm text-signal-text">{error}</p>}
      <div className="flex flex-wrap items-start gap-4">
        <section aria-label="Strategist chat" className="flex min-h-[620px] min-w-0 flex-[2_1_380px] flex-col gap-4 rounded-[14px] bg-ink p-6 text-white lg:sticky lg:top-6">
          <div className="flex items-center gap-2.5">
            <OMark size={22} />
            <span className="lab text-[11px] text-signal">Strategist</span>
          </div>
          <div className="flex max-h-[520px] flex-col gap-4 overflow-y-auto pr-1">
            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="max-w-[85%] self-end rounded-[12px_12px_4px_12px] bg-white px-4 py-3 text-sm leading-normal text-ink">
                  {m.content}
                </div>
              ) : (
                <ChatBlock key={i} text={m.content || (streaming ? "Thinking…" : "")} segments={segments} />
              ),
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="mt-auto flex items-center gap-2 rounded-xl border border-line-dark-2 py-1.5 pl-3.5 pr-1.5">
            <label htmlFor="ask" className="sr-only">Ask the strategist</label>
            <input id="ask" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask why, or ask for another idea" className="min-h-10 min-w-0 flex-1 border-0 bg-transparent text-sm text-white outline-none placeholder:text-smoke" />
            <button type="submit" disabled={streaming} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-lg bg-signal text-signal-ink">
              →
            </button>
          </form>
        </section>
        <section aria-label="Proposed actions" className="flex min-w-0 flex-[3_1_480px] flex-col gap-3">
          {actions.length === 0 && <div className="card text-sm text-ash">No actions for this run. Run the arena first.</div>}
          {actions.map((a) => {
            const on = !!accepted[a.id];
            const applied = a.status === "applied";
            const lift = a.measuredLift ?? a.estLift;
            const measured = a.liftType === "measured";
            return (
              <article key={a.id} className={`flex flex-col gap-3 rounded-[14px] border-2 bg-white p-5 ${on || applied ? "border-signal" : "border-white"}`}>
                <div className="flex flex-wrap items-start gap-3.5">
                  <span className="serif w-[30px] text-4xl leading-[0.9] text-ash">{a.rank}</span>
                  <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="lab text-[10px] text-ash">{KIND[a.kind]}</span>
                      <span className="code-chip text-[10px]">{a.reasonCode}</span>
                      {a.segmentName && <span className="text-xs text-ash">· {a.segmentName}</span>}
                    </div>
                    <h2 className="m-0 text-lg font-semibold">{a.title}</h2>
                    <p className="m-0 text-sm leading-relaxed text-ash-2">{a.detail}</p>
                    {"voice" in a.patch && a.patch.voice && (
                      <p className="m-0 rounded-lg bg-stone px-3 py-2 text-[13px] leading-relaxed text-ash-2">New voice notes: “{a.patch.voice}”</p>
                    )}
                    {on && !applied && "booking" in a.patch && !readOnly && (
                      <label className="mt-1 flex flex-col gap-1.5 text-sm font-medium">
                        Your booking link
                        <input type="url" required placeholder="https://resy.com/your-venue" value={booking} onChange={(e) => setBooking(e.target.value)} className="field field-missing" />
                      </label>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="serif text-[32px] leading-none">
                      {lift >= 0 ? "+" : ""}
                      {lift}
                    </span>
                    <span
                      className={`lab rounded-md px-2 py-0.5 text-[10px] ${measured ? "bg-ink text-white" : "border border-dashed border-ink text-ink"}`}
                    >
                      {measured ? (a.measuredLift !== null ? "Measured lift" : "Projected, then measured") : "Estimated lift"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft pt-3">
                  <span className="mr-auto">
                    <EvidenceLink evidence={a.evidence} label={`${a.evidenceLabel} ↗`} />
                  </span>
                  {applied ? (
                    <span className="lab rounded-full bg-signal px-4 py-2.5 text-[11px] text-signal-ink">Applied ✓</span>
                  ) : readOnly ? (
                    <span className="lab text-[11px] text-ash">{on ? "Accepted in the demo" : "Not applied"}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAccepted({ ...accepted, [a.id]: !on })}
                      aria-pressed={on}
                      className={`btn btn-sm ${on ? "btn-signal" : "btn-ink"}`}
                    >
                      {on ? "Accepted ✓" : "Accept"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          <p className="m-0 text-[13px] leading-relaxed text-ash">
            Card and pitch fixes change your agent card, then the arena re-runs with the same personas, so their lift is measured. Event and hours ideas are business changes; their lift is estimated from Qloo tag affinity and never counted in your measured score.
          </p>
        </section>
      </div>
    </>
  );
}

/** Renders strategist text; a line like [[evidence:segment id]] becomes Qloo evidence chips. */
function ChatBlock({ text, segments }: { text: string; segments: Pick<Segment, "id" | "name" | "seedPool" | "evidence">[] }) {
  const parts = text.split(/(\[\[evidence:[^\]]+\]\])/g);
  return (
    <div className="flex flex-col gap-2.5">
      {parts.map((p, i) => {
        const m = p.match(/^\[\[evidence:([^\]]+)\]\]$/);
        if (!m) return p.trim() ? <p key={i} className="m-0 whitespace-pre-wrap text-[15px] leading-relaxed text-fog">{p.trim()}</p> : null;
        const seg = segments.find((s) => s.id === m[1].trim() || s.name.toLowerCase() === m[1].trim().toLowerCase());
        if (!seg) return null;
        return (
          <div key={i} className="flex flex-col gap-2 rounded-[10px] border border-[#2E2E31] p-3">
            <span className="flex items-center justify-between gap-2">
              <span className="lab text-[10px] text-smoke">Qloo evidence · {seg.name.toLowerCase()}</span>
              <EvidenceLink evidence={seg.evidence} dark label="↗" />
            </span>
            <div className="flex flex-wrap gap-1.5 text-[13px]">
              {seg.seedPool
                .filter((x) => x.type === "artist")
                .slice(0, 3)
                .map((x) => (
                  <span key={x.id} className="rounded-full border border-line-dark-2 px-2.5 py-1">
                    {x.name}
                    {x.affinity !== undefined ? ` ${x.affinity.toFixed(2)}` : ""}
                  </span>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function numberWord(n: number) {
  return ["No", "One", "Two", "Three", "Four", "Five"][n] ?? String(n);
}
