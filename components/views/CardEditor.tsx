"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { readinessItems, readinessScore } from "@/lib/readiness";
import { DAYS, DAY_LABEL, type AgentCardDoc, type CardFacts, type Day, type VenueReply } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { normRange } from "@/lib/qloo/parse";

interface Props {
  venueId: string;
  venueName: string;
  slug: string;
  claimed: boolean;
  card: AgentCardDoc;
  versions: { version: number; createdAt: number; readiness: number; note?: string }[];
  readOnly: boolean;
}

const split = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

function hoursFrom(h: CardFacts["hours"]) {
  const out = {} as Record<Day, { open: string; close: string; closed: boolean }>;
  for (const d of DAYS) {
    const v = h?.[d];
    if (!v) out[d] = { open: "", close: "", closed: false };
    else if (v === "closed") out[d] = { open: "", close: "", closed: true };
    else {
      const [o, c] = normRange(v).split("-");
      out[d] = { open: o ?? "", close: c ?? "", closed: false };
    }
  }
  return out;
}

export function CardEditor({ venueId, venueName, slug, claimed, card, versions, readOnly }: Props) {
  const router = useRouter();
  const f = card.facts;
  const [hours, setHours] = useState(hoursFrom(f.hours));
  const [booking, setBooking] = useState(f.booking ?? "");
  const [price, setPrice] = useState<CardFacts["priceBand"]>(f.priceBand);
  const [party, setParty] = useState(f.partyMax ? String(f.partyMax) : "");
  const [drinks, setDrinks] = useState(f.drinks.join(", "));
  const [dishes, setDishes] = useState(f.dishes.join(", "));
  const [music, setMusic] = useState(f.music ?? "");
  const [vibe, setVibe] = useState(f.vibe ?? "");
  const [events, setEvents] = useState(f.events.length ? f.events : []);
  const [rules, setRules] = useState(f.rules.join(", "));
  const [tags, setTags] = useState(() => [...new Set(f.tasteTags)]);
  const [address, setAddress] = useState(f.address ?? "");
  const [voice, setVoice] = useState(card.voice);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  const facts: CardFacts = useMemo(() => {
    const anyHours = DAYS.some((d) => hours[d].closed || (hours[d].open && hours[d].close));
    const h = anyHours
      ? (Object.fromEntries(DAYS.map((d) => [d, hours[d].closed ? "closed" : hours[d].open && hours[d].close ? `${hours[d].open}-${hours[d].close}` : ""])) as Record<Day, string>)
      : null;
    return {
      hours: h,
      priceBand: price,
      partyMax: party ? Math.max(1, Math.min(500, Number(party))) : null,
      booking: booking.trim() || null,
      address: address.trim() || null,
      dishes: split(dishes).slice(0, 30),
      drinks: split(drinks).slice(0, 30),
      music: music.trim() || null,
      vibe: vibe.trim() || null,
      rules: split(rules).slice(0, 20),
      events: events.filter((e) => e.title.trim()).slice(0, 20),
      tasteTags: tags,
    };
  }, [hours, price, party, booking, address, dishes, drinks, music, vibe, rules, events, tags]);

  const score = readinessScore(facts, voice);
  const missing = new Set(readinessItems(facts, voice).filter((i) => !i.done).map((i) => i.field));
  const dirty = JSON.stringify(facts) !== JSON.stringify(card.facts) || voice !== card.voice;

  async function publish() {
    setSaving(true);
    setMsg(null);
    const r = await fetch(`/api/venues/${venueId}/card`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ facts, voice }) });
    const j = await r.json();
    setSaving(false);
    if (!r.ok) return setMsg(j.error || "Could not publish");
    setMsg(`Published v${j.version}. Readiness ${j.readiness}/100.`);
    router.refresh();
  }

  const miss = (k: string) => (missing.has(k) ? "field field-missing" : "field");
  const MissTag = ({ k, pts }: { k: string; pts: number }) =>
    missing.has(k) ? <span className="lab text-[10px] text-signal-text">Missing · {pts} pts</span> : null;

  const preview = {
    name: venueName,
    url: `/v/${slug}/a2a`,
    version: `${card.version + (dirty ? 1 : 0)}.0.0`,
    skills: ["check_fit", "check_availability", "get_menu_highlights", "request_booking"],
    spotlit: { claimed, tasteTags: tags.slice(0, 8), readiness: score },
    hours: facts.hours,
    booking: facts.booking,
    priceBand: facts.priceBand,
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="lab text-ash">{venueName} · Agent card v{card.version}</span>
          <h1 className="serif m-0 text-[clamp(44px,5vw,68px)] leading-none">
            What your agent <em className="text-signal-text">knows</em>.
          </h1>
          <p className="m-0 max-w-[620px] text-[15px] leading-relaxed text-ash-2">
            Your agent only says what&apos;s on this card. Anything missing becomes &ldquo;unknown&rdquo; when a concierge asks, and that costs you picks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="lab text-[11px] text-ash">Readiness {score}/100</span>
          <button type="button" className="btn btn-sm btn-line bg-white" onClick={() => setShowVersions((s) => !s)}>Version history</button>
          {!readOnly && (
            <button type="button" className="btn btn-sm btn-ink" onClick={publish} disabled={!dirty || saving}>
              {saving ? "Publishing…" : `Publish v${card.version + 1}`}
            </button>
          )}
        </div>
      </div>
      {msg && <div role="status" className="lab self-start rounded-md bg-ink px-3 py-2 text-[11px] text-white">{msg}</div>}
      {showVersions && (
        <section className="card gap-2">
          <span className="lab text-ash">Versions</span>
          {versions.map((v) => (
            <div key={v.version} className="flex flex-wrap justify-between gap-3 border-t border-line-soft py-2 text-sm">
              <span><strong>v{v.version}</strong> · {v.note || "Saved"}</span>
              <span className="lab text-[11px] text-ash">{fmtDate(v.createdAt)} · readiness {v.readiness}</span>
            </div>
          ))}
        </section>
      )}
      <div className="flex flex-wrap items-start gap-4">
        <form className="flex min-w-0 flex-[3_1_460px] flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
          <fieldset disabled={readOnly} className="m-0 flex flex-col gap-4 border-0 p-0">
            <section className="card">
              <span className="lab text-ash">Facts</span>
              <div id="hours" className="flex flex-col gap-2 text-sm font-medium">
                <span className="flex justify-between">Opening hours<MissTag k="hours" pts={15} /></span>
                <div className={`grid gap-1.5 rounded-[10px] p-2 ${missing.has("hours") ? "border-[1.5px] border-signal bg-[#FFF6F2]" : "border border-line"}`}>
                  {DAYS.map((d) => (
                    <div key={d} className="grid grid-cols-[92px_1fr_1fr_auto] items-center gap-2 text-[13px]">
                      <span>{DAY_LABEL[d]}</span>
                      <input aria-label={`${DAY_LABEL[d]} opens`} type="time" value={hours[d].open} disabled={hours[d].closed} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], open: e.target.value } })} className="field min-h-9 py-1 text-sm" />
                      <input aria-label={`${DAY_LABEL[d]} closes`} type="time" value={hours[d].close} disabled={hours[d].closed} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d], close: e.target.value } })} className="field min-h-9 py-1 text-sm" />
                      <label className="flex items-center gap-1.5 text-[12px] text-ash">
                        <input type="checkbox" checked={hours[d].closed} onChange={(e) => setHours({ ...hours, [d]: { open: "", close: "", closed: e.target.checked } })} className="accent-ink" />
                        Closed
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <label id="booking" className="flex flex-col gap-2 text-sm font-medium">
                <span className="flex justify-between">Booking link<MissTag k="booking" pts={15} /></span>
                <input type="url" placeholder="https://" value={booking} onChange={(e) => setBooking(e.target.value)} className={miss("booking")} />
              </label>
              <div className="flex flex-wrap gap-3">
                <label id="priceBand" className="flex flex-[1_1_140px] flex-col gap-2 text-sm font-medium">
                  Price band
                  <select value={price ?? ""} onChange={(e) => setPrice((e.target.value || null) as CardFacts["priceBand"])} className={miss("priceBand")}>
                    <option value="">Not set</option>
                    <option>$</option>
                    <option>$$</option>
                    <option>$$$</option>
                    <option>$$$$</option>
                  </select>
                </label>
                <label id="partyMax" className="flex flex-[1_1_140px] flex-col gap-2 text-sm font-medium">
                  Max party size
                  <input type="number" min={1} max={500} value={party} onChange={(e) => setParty(e.target.value)} className={miss("partyMax")} />
                </label>
              </div>
              <label id="dishes" className="flex flex-col gap-2 text-sm font-medium">
                Drinks (comma separated)
                <textarea rows={2} value={drinks} onChange={(e) => setDrinks(e.target.value)} className={`${miss("dishes")} resize-y`} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Dishes (comma separated)
                <textarea rows={2} value={dishes} onChange={(e) => setDishes(e.target.value)} className={`${miss("dishes")} resize-y`} />
              </label>
              <label id="music" className="flex flex-col gap-2 text-sm font-medium">
                Music
                <textarea rows={2} value={music} onChange={(e) => setMusic(e.target.value)} className={`${miss("music")} resize-y`} />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Vibe
                <textarea rows={2} value={vibe} onChange={(e) => setVibe(e.target.value)} className={`${miss("music")} resize-y`} />
              </label>
              <div id="events" className="flex flex-col gap-2 text-sm font-medium">
                <span className="flex justify-between">Upcoming events<MissTag k="events" pts={10} /></span>
                {events.map((ev, i) => (
                  <div key={i} className="flex flex-wrap gap-2">
                    <input aria-label="Event name" placeholder="Spiritual jazz night" value={ev.title} onChange={(e) => setEvents(events.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} className="field flex-[2_1_200px]" />
                    <input aria-label="When" placeholder="Thursdays from 8pm" value={ev.when} onChange={(e) => setEvents(events.map((x, j) => (j === i ? { ...x, when: e.target.value } : x)))} className="field flex-[1_1_140px]" />
                    <button type="button" className="btn btn-sm btn-line" onClick={() => setEvents(events.filter((_, j) => j !== i))}>Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => setEvents([...events, { title: "", when: "" }])} className={`btn btn-sm self-start ${missing.has("events") ? "border-[1.5px] border-signal bg-[#FFF6F2] text-ink" : "btn-line"}`}>
                  Add an event
                </button>
              </div>
              <label className="flex flex-col gap-2 text-sm font-medium">
                House rules (comma separated)
                <input value={rules} onChange={(e) => setRules(e.target.value)} className="field" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">
                Address
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="field" />
              </label>
              <div id="tasteTags" className="flex flex-col gap-2 text-sm font-medium">
                <span className="flex justify-between">Taste tags from Qloo<MissTag k="tasteTags" pts={15} /></span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[13px] font-normal">
                      {t}
                      {!readOnly && (
                        <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="text-ash hover:text-ink">×</button>
                      )}
                    </span>
                  ))}
                  {!tags.length && <span className="text-[13px] font-normal text-ash">Build Taste DNA to add Qloo tags</span>}
                </div>
              </div>
            </section>
            <section className="card gap-3.5">
              <span className="lab text-ash">Voice</span>
              <label id="voice" className="flex flex-col gap-2 text-sm font-medium">
                How your agent should sound, and what to mention
                <textarea rows={3} value={voice} onChange={(e) => setVoice(e.target.value)} className={`${miss("voice")} resize-y`} placeholder="Warm, a little nerdy about records, never pushy. For dates mention the corner booth by the speakers." />
              </label>
              <p className="m-0 text-[13px] text-ash">Short notes make generic replies. Specific notes (a seat, a record, a drink) win PITCH_GAP losses back.</p>
            </section>
          </fieldset>
        </form>
        <div className="flex min-w-0 flex-[2_1_380px] flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[14px] bg-ink p-6 text-fog">
            <div className="flex flex-wrap justify-between gap-2">
              <a href={`/v/${slug}/.well-known/agent-card.json`} target="_blank" rel="noreferrer" className="lab text-[11px] text-smoke hover:text-white">
                agent-card.json · live ↗
              </a>
              <span className="lab text-[11px] text-signal">A2A</span>
            </div>
            <pre className="m-0 overflow-x-auto font-mono text-[12px] leading-[1.7]">
              {JSON.stringify(preview, null, 2)
                .split("\n")
                .map((line, i) => (
                  <span key={i} className={/"(hours|booking|priceBand)": null/.test(line) ? "text-signal" : undefined}>
                    {line}
                    {"\n"}
                  </span>
                ))}
            </pre>
          </section>
          <TestChat venueId={venueId} disabled={readOnly} dirty={dirty} />
        </div>
      </div>
    </>
  );
}

function TestChat({ venueId, disabled, dirty }: { venueId: string; disabled: boolean; dirty: boolean }) {
  const [msgs, setMsgs] = useState<{ role: "user" | "agent"; text: string; reply?: VenueReply }[]>([]);
  const [text, setText] = useState("Are you open Friday at 9 for two?");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const t = text.trim();
    setMsgs((m) => [...m, { role: "user", text: t }]);
    setText("");
    setBusy(true);
    const r = await fetch(`/api/venues/${venueId}/test`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t }) });
    const j = await r.json();
    setBusy(false);
    setMsgs((m) => [...m, { role: "agent", text: r.ok ? j.reply.pitch : j.error || "No reply", reply: r.ok ? j.reply : undefined }]);
  }

  return (
    <section className="card gap-3.5 p-6">
      <span className="lab text-ash">Test your agent</span>
      {dirty && <span className="text-[12px] text-ash">Uses the published card. Publish to test your edits.</span>}
      <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto">
        {msgs.length === 0 && <p className="m-0 text-sm text-ash">Ask like a concierge agent would. This uses the same agent code as A2A.</p>}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="max-w-[85%] self-end rounded-[12px_12px_4px_12px] bg-stone px-3.5 py-2.5 text-sm">{m.text}</div>
          ) : (
            <div key={i} className="flex max-w-[92%] gap-2.5">
              <span className="mt-0.5 h-[22px] w-[22px] shrink-0 rounded bg-signal" />
              <div className="rounded-[12px_12px_12px_4px] border border-signal-soft bg-[#FFF6F2] px-3.5 py-2.5 text-sm leading-normal">
                {m.text}
                {m.reply && (
                  <span className="lab mt-1.5 block text-[10px] text-signal-text">
                    availability: {m.reply.availability}
                    {m.reply.availability === "unknown" ? " → INFO_GAP" : ""} · price: {m.reply.priceFit}
                  </span>
                )}
              </div>
            </div>
          ),
        )}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 rounded-xl border border-line py-1.5 pl-3.5 pr-1.5">
        <label htmlFor="test-msg" className="sr-only">Message your agent</label>
        <input id="test-msg" disabled={disabled} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask like a concierge would" className="min-h-10 min-w-0 flex-1 border-0 text-sm outline-none" />
        <button type="submit" disabled={disabled || busy} aria-label="Send" className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white">
          {busy ? "…" : "→"}
        </button>
      </form>
    </section>
  );
}
