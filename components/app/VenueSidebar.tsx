"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/spotlit/Brand";
import { ReadinessBar } from "@/components/spotlit/Badges";

export interface SidebarVenue {
  id: string;
  name: string;
  slug: string;
  place: string;
  claimed: boolean;
  readiness: number;
}

const SECTIONS = [
  ["dna", "Taste DNA"],
  ["rivals", "Rivals"],
  ["card", "Agent card"],
  ["arena", "Arena"],
  ["report", "Report"],
  ["strategist", "Strategist"],
  ["compare", "Before and after"],
  ["inbox", "Agent inbox"],
] as const;

export function VenueSidebar({ venue, base, others = [], demo = false }: { venue: SidebarVenue; base: string; others?: { id: string; name: string }[]; demo?: boolean }) {
  const path = usePathname();
  const active = (seg: string) => {
    if (demo && seg === "report") return path === base || path.startsWith(`${base}/report`);
    return path === `${base}/${seg}` || path.startsWith(`${base}/${seg}/`);
  };
  return (
    <aside className="flex w-full min-w-0 flex-col gap-4 bg-ink px-4 py-4 text-white lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:max-w-[280px] lg:flex-[1_1_240px] lg:gap-6 lg:overflow-y-auto lg:py-6">
      <div className="px-3">
        <Wordmark width={104} href={demo ? "/" : "/app"} />
      </div>
      <div className="mx-1 flex items-center gap-3 rounded-xl border border-line-dark p-3">
        <span className={`h-8 w-8 shrink-0 rounded-lg ${venue.claimed ? "bg-signal" : "border-[1.5px] border-dashed border-mist"}`} />
        <span className="flex min-w-0 flex-col">
          <strong className="truncate text-sm">{venue.name}</strong>
          <span className="truncate text-xs text-smoke">
            {venue.place} · {demo ? "Demo, read only" : venue.claimed ? "Claimed" : "Unclaimed"}
          </span>
        </span>
      </div>
      {others.length > 0 && (
        <label className="mx-1 flex flex-col gap-1.5">
          <span className="lab text-[10px] text-smoke">Switch venue</span>
          <select
            className="min-h-10 rounded-lg border border-line-dark bg-ink-3 px-2 text-sm text-white"
            value={venue.id}
            onChange={(e) => (window.location.href = `/app/v/${e.target.value}/dna`)}
          >
            <option value={venue.id}>{venue.name}</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <nav aria-label="Venue" className="-mx-1 flex gap-0.5 overflow-x-auto pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:pb-0">
        {SECTIONS.map(([seg, label], i) => {
          const on = active(seg);
          return (
            <Link key={seg} href={demo && seg === "report" ? base : `${base}/${seg}`} className="nav-item shrink-0 whitespace-nowrap" aria-current={on ? "page" : undefined}>
              <span className={`lab text-[10px] ${on ? "text-signal-text" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
              {label}
            </Link>
          );
        })}
        <Link href={`/v/${venue.slug}`} className="nav-item shrink-0 whitespace-nowrap" target="_blank">
          <span className="lab text-[10px]">↗</span>Public page
        </Link>
      </nav>
      <div className="mx-1 mt-auto hidden flex-col gap-2.5 rounded-xl bg-ink-3 p-3.5 lg:flex">
        <div className="flex justify-between">
          <span className="lab text-[10px] text-smoke">Agent readiness</span>
          <span className="lab text-[11px]">{venue.readiness}/100</span>
        </div>
        <ReadinessBar value={venue.readiness} />
      </div>
      {demo ? (
        <Link href="/signup" className="btn btn-sm btn-signal mx-1 hidden lg:inline-flex">Scan your own venue</Link>
      ) : (
        <Link href="/app" className="mx-1 hidden text-[13px] text-mist hover:text-white lg:block">← All venues</Link>
      )}
    </aside>
  );
}
