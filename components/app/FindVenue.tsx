"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EvidenceLink } from "@/components/spotlit/EvidenceLink";
import type { Evidence } from "@/lib/types";
import { Busy, LoadingSteps } from "@/components/spotlit/Loading";

interface Result {
  qlooId: string;
  name: string;
  address: string | null;
  neighborhood: string | null;
  category: string;
  tagCount: number;
  tags: string[];
  venueId: string | null;
  claimed: boolean;
}

export function FindVenue({ defaultCity }: { defaultCity: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [city, setCity] = useState(defaultCity);
  const [results, setResults] = useState<Result[] | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Describe it
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [vibe, setVibe] = useState("");
  const [hood, setHood] = useState("");
  const [price, setPrice] = useState<"$" | "$$" | "$$$">("$$");
  const [mapped, setMapped] = useState<{ id: string; name: string }[]>([]);
  const [mapping, setMapping] = useState(false);
  const [creating, setCreating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/venues/search?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setResults(j.results);
        setEvidence(j.evidence);
      } catch (e) {
        setError((e as Error).message || "Search failed");
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [q, city]);

  useEffect(() => {
    if (mapTimer.current) clearTimeout(mapTimer.current);
    const text = [kind, vibe].filter(Boolean).join(", ");
    if (text.trim().length < 4) {
      setMapped([]);
      return;
    }
    mapTimer.current = setTimeout(async () => {
      setMapping(true);
      try {
        const r = await fetch("/api/venues/describe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
        const j = await r.json();
        if (r.ok) setMapped(j.tags);
      } finally {
        setMapping(false);
      }
    }, 600);
  }, [kind, vibe]);

  async function pick(r: Result) {
    if (r.venueId) return router.push(`/app/new/claim/${r.venueId}`);
    setBusyId(r.qlooId);
    setError(null);
    try {
      const res = await fetch("/api/venues", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "qloo", qlooId: r.qlooId, name: r.name, city }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/app/new/claim/${j.venueId}`);
    } catch (e) {
      setError((e as Error).message);
      setBusyId(null);
    }
  }

  async function describe(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/venues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "describe", name, city, neighborhood: hood || undefined, kind, vibe: vibe || undefined, price }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      router.push(`/app/new/claim/${j.venueId}`);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  const darkInput = "w-full min-h-12 rounded-[10px] border border-[#2E2E31] bg-ink-3 px-3.5 text-[15px] text-white placeholder:text-smoke focus:outline-2 focus:outline-signal";

  return (
    <div className="flex flex-wrap items-start gap-4">
      <section className="flex min-w-0 flex-[3_1_520px] flex-col gap-4 rounded-[14px] bg-white p-7">
        <div className="flex flex-wrap gap-2.5">
          <label className="flex flex-[3_1_260px] flex-col gap-2 text-sm font-medium">
            Venue name
            <span className="relative">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6A66" strokeWidth="2" aria-hidden="true" className="absolute left-3.5 top-[15px]">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-4-4" />
              </svg>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Qloo places" className="field min-h-12 pl-11" autoFocus />
            </span>
          </label>
          <label className="flex flex-[1_1_160px] flex-col gap-2 text-sm font-medium">
            City
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="field min-h-12" />
          </label>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span className="lab text-[11px] text-ash">
            {loading ? <Busy size={12} label="Searching Qloo…" /> : results ? `${results.length} match${results.length === 1 ? "" : "es"} from Qloo` : "Type at least two letters"}
          </span>
          <EvidenceLink evidence={evidence} />
        </div>
        {error && <p role="alert" className="m-0 text-sm text-signal-text">{error}</p>}
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {results?.map((r, i) => (
            <li key={r.qlooId}>
              <button
                type="button"
                onClick={() => pick(r)}
                disabled={!!busyId}
                className={`flex w-full items-center gap-4 rounded-xl p-4 text-left text-ink ${i === 0 ? "border-2 border-ink" : "border border-line hover:border-ink"}`}
              >
                <span className={`h-11 w-11 shrink-0 rounded-[10px] ${r.claimed ? "bg-signal" : "border-[1.5px] border-dashed border-ash"}`} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <strong className="text-base">{r.name}</strong>
                  <span className="truncate text-[13px] text-ash">
                    {r.category} · {r.neighborhood ?? r.address ?? city}
                    {r.tagCount ? ` · ${r.tagCount} taste tags` : ""}
                    {r.claimed ? " · Already claimed" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{busyId === r.qlooId ? <Busy size={14} label="Opening…" /> : "This is mine →"}</span>
              </button>
            </li>
          ))}
          {results && results.length === 0 && !loading && <li className="rounded-xl border border-dashed border-line p-4 text-sm text-ash">No Qloo match. Describe it instead.</li>}
        </ul>
      </section>

      <form onSubmit={describe} className="flex min-w-0 flex-[2_1_360px] flex-col gap-4 rounded-[14px] bg-ink p-7 text-white">
        <span className="lab text-[11px] text-signal">Not listed?</span>
        <h2 className="serif m-0 text-4xl leading-[1.05]">Describe it instead.</h2>
        <label className="flex flex-col gap-2 text-sm font-medium text-fog">
          Venue name
          <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={darkInput} placeholder="Halftone House" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-fog">
          Neighbourhood
          <input value={hood} onChange={(e) => setHood(e.target.value)} className={darkInput} placeholder="Williamsburg" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-fog">
          What kind of place
          <input required minLength={2} value={kind} onChange={(e) => setKind(e.target.value)} className={darkInput} placeholder="Listening bar, wine bar, ramen counter" />
        </label>
        <label className="flex flex-col gap-2 text-sm font-medium text-fog">
          Vibe and music
          <textarea value={vibe} onChange={(e) => setVibe(e.target.value)} rows={3} className={`${darkInput} resize-y py-3`} placeholder="Dim, vinyl only, psych soul and city pop" />
        </label>
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-sm font-medium text-fog">Price</legend>
          <div className="flex flex-wrap gap-2">
            {(["$", "$$", "$$$"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={price === p}
                onClick={() => setPrice(p)}
                className={`min-h-10 rounded-full border px-3.5 text-sm ${price === p ? "border-white bg-white text-ink" : "border-[#2E2E31] bg-ink-3 text-fog"}`}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-2.5 border-t border-line-dark pt-4">
          <span className="lab text-[10px] text-smoke">{mapping ? <Busy size={12} label="Mapping to Qloo tags…" /> : "Mapped to Qloo tags"}</span>
          <div className="flex flex-wrap gap-1.5 text-[13px]">
            {mapped.length ? mapped.map((t) => <span key={t.id} className="rounded-full border border-line-dark-2 px-2.5 py-1">{t.name}</span>) : <span className="text-smoke">Tags appear as you type</span>}
          </div>
        </div>
        <button type="submit" disabled={creating || !name || !kind} className="btn btn-signal">
          {creating ? <LoadingSteps every={3500} steps={["Creating your venue…", "Saving your Qloo taste tags…", "Preparing your agent card…"]} /> : "Build my Taste DNA"}
        </button>
      </form>
    </div>
  );
}
