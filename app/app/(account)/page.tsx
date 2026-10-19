import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "@/components/spotlit/Brand";
import { pageUser } from "@/lib/guard";
import { getUserDoc } from "@/lib/auth";
import { ownerDashboard } from "@/lib/owner";
import { getDemoMeta } from "@/lib/demo";
import { CATEGORY_LABEL } from "@/lib/venues";
import { fmtDate, timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "My venues" };

const OUTCOME_STYLE: Record<string, string> = {
  recommended: "bg-signal text-signal-ink",
  top3: "border border-ink text-ink",
  answered: "border border-line text-ash-2",
  unknown: "border border-dashed border-ash text-ash-2",
  lost: "bg-ink text-white",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function MyVenuesPage() {
  const user = await pageUser("/app");
  const [doc, { cards, activity }, demo] = await Promise.all([getUserDoc(user.uid), ownerDashboard(user.uid), getDemoMeta()]);
  const first = (doc?.name ?? user.name).split(" ")[0];

  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-24 pt-12 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <span className="lab text-ash">{greeting()}, {first}</span>
          <h1 className="serif m-0 text-[clamp(48px,6vw,76px)] leading-none">My venues</h1>
        </div>
        <Link href="/app/new" className="btn btn-ink">
          <Plus />
          Add a venue
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4">
        {cards.map(({ venue, setupDone, nextStep, asksThisWeek, lastRun, actionsWaiting }) => {
          const live = !!venue.latestRunId;
          return (
            <article key={venue.id} className="flex flex-col overflow-hidden rounded-[14px] bg-white">
              <div className="relative h-[140px] overflow-hidden bg-ink">
                {live ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/brand/halftone-city-heatmap-1920x1080.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/brand/halftone-orb-1080.webp" alt="" aria-hidden="true" className="absolute left-1/2 top-1/2 h-[220px] -translate-x-1/2 -translate-y-1/2 opacity-60" />
                )}
                <span
                  className={`lab absolute left-4 top-4 rounded-full border bg-ink/70 px-2.5 py-0.5 text-[10px] ${live ? "border-signal text-signal" : "border-[#5A5A5E] text-fog"}`}
                >
                  {live ? "Agent online" : `Setup ${setupDone} of 4`}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-4 p-6">
                <div>
                  <h2 className="serif m-0 text-[34px] leading-none">{venue.name}</h2>
                  <span className="text-sm text-ash">
                    {CATEGORY_LABEL[venue.category]} · {venue.neighborhood ?? venue.city}
                  </span>
                </div>
                {live ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 border-t border-line-soft pt-4">
                      <Stat value={venue.latestSoav !== null ? `${Math.round(venue.latestSoav * 100)}%` : "–"} label="Agent voice" accent />
                      <Stat value={String(venue.readiness)} label="Readiness" />
                      <Stat value={String(asksThisWeek)} label="Asks this week" />
                    </div>
                    <span className="text-[13px] text-ash">
                      Last arena run {lastRun ? fmtDate(lastRun.startedAt) : "never"}
                      {actionsWaiting ? ` · ${actionsWaiting} action${actionsWaiting > 1 ? "s" : ""} waiting` : ""}
                    </span>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link href={`/app/v/${venue.id}/report/${venue.latestRunId}`} className="btn btn-sm btn-ink flex-1">Open dashboard</Link>
                      <Link href={`/app/v/${venue.id}/arena`} className="btn btn-sm btn-line">New run</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 border-t border-line-soft pt-4">
                      <div className="flex justify-between text-[13px]">
                        <span>Agent readiness</span>
                        <span className="lab text-[11px]">{venue.readiness}/100</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-stone">
                        <div className="h-1.5 rounded-full bg-ink" style={{ width: `${venue.readiness}%` }} />
                      </div>
                    </div>
                    {nextStep && <span className="text-[13px] text-ash">{nextStep.label}</span>}
                    <div className="mt-auto flex gap-2">
                      <Link href={nextStep?.href ?? `/app/v/${venue.id}/dna`} className="btn btn-sm btn-signal flex-1">Finish setup</Link>
                    </div>
                  </>
                )}
              </div>
            </article>
          );
        })}

        <Link
          href="/app/new"
          className="flex min-h-[380px] flex-col items-center justify-center gap-3.5 rounded-[14px] border-[1.5px] border-dashed border-[#A9A79F] p-6 text-center text-ink no-underline hover:border-ink"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-xl border-[1.5px] border-dashed border-ash">
            <Plus size={22} />
          </span>
          <span className="serif text-[30px] leading-none">{cards.length ? "Add another venue" : "Add your first venue"}</span>
          <span className="max-w-[240px] text-sm text-ash">Find it in Qloo or describe it. Each venue gets its own agent.</span>
        </Link>

        {demo?.status === "ready" && (
          <Link href="/demo" className="flex min-h-[380px] flex-col justify-between overflow-hidden rounded-[14px] bg-ink p-6 text-white no-underline">
            <span className="lab self-start rounded-full border border-signal px-2.5 py-0.5 text-[10px] text-signal">Demo venue · read only</span>
            <div className="flex flex-col gap-2">
              <span className="serif text-[34px] leading-none">Halftone House</span>
              <span className="text-sm text-mist">A fictional Brooklyn listening bar with a full baseline run, fixes and a measured what if run.</span>
              <span className="mt-2 text-sm font-semibold text-signal">Open the demo →</span>
            </div>
          </Link>
        )}
      </div>

      <section className="flex flex-col gap-1.5 rounded-[14px] bg-white p-7">
        <span className="lab pb-2.5 text-ash">Recent activity</span>
        {activity.length === 0 && <p className="m-0 border-t border-line-soft py-3 text-sm text-ash">No activity yet. Add a venue to get started.</p>}
        {activity.map((a, i) => (
          <div key={i} className="flex flex-wrap items-center gap-4 border-t border-line-soft py-3">
            <span className="lab w-20 text-[10px] text-ash">{timeAgo(a.at)}</span>
            <span className="min-w-0 flex-1 text-sm">{a.text}</span>
            {a.badge && <span className={`lab rounded-md px-2 py-0.5 text-[10px] ${OUTCOME_STYLE[a.badge] ?? ""}`}>{a.badge === "top3" ? "Top 3" : a.badge}</span>}
            {a.href && (
              <Link href={a.href} className="text-[13px] font-semibold text-signal-text">
                {a.hrefLabel}
              </Link>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}

function Stat({ value, label, accent = false }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className={`serif text-[32px] leading-none ${accent ? "text-signal-text" : ""}`}>{value}</span>
      <span className="lab text-[9px] text-ash">{label}</span>
    </div>
  );
}
