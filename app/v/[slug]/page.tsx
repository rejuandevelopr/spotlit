import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/spotlit/PublicHeader";
import { EvidenceLink } from "@/components/spotlit/EvidenceLink";
import { ProxyLabel } from "@/components/spotlit/Badges";
import { CATEGORY_LABEL, getProfile, getVenueBySlug, latestCard } from "@/lib/venues";
import { DAYS, DAY_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const v = await getVenueBySlug(slug);
  return { title: v ? `${v.name}${v.isClaimed ? "" : " (unclaimed)"}` : "Venue" };
}

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const hh = h % 24;
  const suf = hh >= 12 ? "pm" : "am";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""}${suf}`;
}

export default async function VenuePublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) notFound();
  const [card, profile] = await Promise.all([latestCard(venue.id), getProfile(venue.id)]);
  const f = card?.facts;
  // The owner's published card tags come first, then Qloo insight tags fill the rest.
  const tags = [...new Set([...(f?.tasteTags ?? []), ...(profile?.tags ?? venue.qlooTags).map((t) => t.name)])].slice(0, 8);
  const claimed = venue.isClaimed;
  const about = f?.vibe ?? (claimed ? null : `Public data from Qloo associates ${venue.name} with ${tags.slice(0, 3).join(", ").toLowerCase()}.`);

  return (
    <div className="min-h-screen bg-stone text-ink">
      <PublicHeader />
      <main className="mx-auto flex max-w-[1180px] flex-col gap-4 px-4 pb-24 pt-6 sm:px-8">
        <section className="relative overflow-hidden rounded-[14px] bg-ink text-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/halftone-spotlight-hero-1920x1080.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-55" />
          <div className="relative flex flex-col gap-4 px-6 pb-12 pt-16 sm:px-12 sm:pt-[72px]">
            <div className="flex flex-wrap gap-2.5">
              {claimed ? (
                <span className="lab rounded-full border border-signal px-2.5 py-1 text-[11px] text-signal">Claimed venue</span>
              ) : (
                <span className="lab rounded-full border border-mist px-2.5 py-1 text-[11px] text-fog">Unclaimed, public data only</span>
              )}
              <span className="lab rounded-full border border-[#5A5A5E] px-2.5 py-1 text-[11px] text-fog">Agent online</span>
              {venue.isFictional && <span className="lab rounded-full border border-[#5A5A5E] px-2.5 py-1 text-[11px] text-fog">Fictional demo venue</span>}
            </div>
            <h1 className="serif m-0 text-[clamp(56px,8vw,104px)] leading-[0.95]">{venue.name}</h1>
            <p className="m-0 max-w-[620px] text-lg leading-relaxed text-fog">
              {CATEGORY_LABEL[venue.category]} in {[venue.neighborhood, venue.city].filter(Boolean).join(", ")}.{about ? ` ${about}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              <Link className="btn btn-signal" href={`/concierge?venue=${venue.slug}`}>Ask {claimed ? "our" : "its"} agent</Link>
              <a className="btn btn-line-dark" href={`/v/${venue.slug}/.well-known/agent-card.json`}>View agent card</a>
              {!claimed && <Link className="btn btn-line-dark" href={`/app/new/claim/${venue.id}`}>Is this yours? Claim it</Link>}
            </div>
          </div>
        </section>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
          <div className="flex flex-col gap-2 rounded-[14px] bg-white p-6">
            <span className="lab text-[11px] text-ash">Hours</span>
            {f?.hours ? (
              <span className="text-[15px] leading-relaxed">
                {DAYS.map((d) => {
                  const v = f.hours?.[d];
                  if (!v) return null;
                  const [o, c] = v.split("-");
                  return (
                    <span key={d} className="block">
                      {DAY_LABEL[d].slice(0, 3)} {v === "closed" ? "closed" : `${fmtTime(o)} to ${fmtTime(c)}`}
                    </span>
                  );
                })}
              </span>
            ) : (
              <span className="text-[15px] text-ash">Not listed{claimed ? " yet" : ". Public data has no hours."}</span>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded-[14px] bg-white p-6">
            <span className="lab text-[11px] text-ash">Price</span>
            <span className="serif text-[44px] leading-none">{f?.priceBand ?? "–"}</span>
            {f?.drinks[0] && <span className="text-sm text-ash-2">Try the {f.drinks[0].toLowerCase()}</span>}
          </div>
          <div className="flex flex-col gap-2 rounded-[14px] bg-white p-6">
            <span className="lab text-[11px] text-ash">Groups</span>
            <span className="serif text-[44px] leading-none">{f?.partyMax ? `Up to ${f.partyMax}` : "–"}</span>
            {f?.rules[0] && <span className="text-sm text-ash-2">{f.rules[0]}</span>}
          </div>
          <div id="book" className="flex flex-col gap-2 rounded-[14px] bg-white p-6">
            <span className="lab text-[11px] text-ash">Address</span>
            <span className="text-[15px] leading-relaxed">{f?.address ?? venue.address ?? venue.city}</span>
            {f?.booking && !venue.isFictional && (
              <a href={f.booking} className="text-sm text-signal-text" rel="noreferrer" target="_blank">Book a table</a>
            )}
            {venue.isFictional && <span className="text-sm text-ash">Booking disabled: fictional demo venue</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <section className="flex min-w-0 flex-[3_1_520px] flex-col gap-5 rounded-[14px] bg-white p-8">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="lab text-ash">Taste DNA</span>
              <EvidenceLink evidence={profile?.evidence.tags} />
            </div>
            <h2 className="serif m-0 text-[40px] leading-[1.05]">Loved by people who love</h2>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t} className="rounded-full border border-line px-3 py-1.5 text-sm">{t}</span>
              ))}
            </div>
            {profile && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4 border-t border-line-soft pt-5">
                {(
                  [
                    ["Artists", profile.affinities.artists],
                    ["Films", profile.affinities.films],
                    ["Brands", profile.affinities.brands],
                  ] as const
                ).map(([label, list]) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <span className="lab text-[11px] text-ash">{label}</span>
                    <span className="text-[15px] leading-relaxed">
                      {list.slice(0, 3).map((x) => (
                        <span key={x.id} className="block">{x.name}</span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {!claimed && <ProxyLabel />}
          </section>
          <section className="flex min-w-0 flex-[2_1_340px] flex-col gap-4 rounded-[14px] bg-white p-8">
            <span className="lab text-ash">Coming up</span>
            <div className="flex flex-col gap-3.5">
              {f?.events.length ? (
                f.events.map((e, i) => (
                  <div key={i} className="flex gap-4 border-b border-line-soft pb-3.5 last:border-0">
                    <span className="lab w-11 shrink-0 text-[11px] text-signal-text">Next</span>
                    <div>
                      <div className="font-semibold">{e.title}</div>
                      <div className="text-sm text-ash">{e.when}</div>
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-sm text-ash">No events listed.</span>
              )}
            </div>
            <div className="mt-auto flex flex-col gap-2 rounded-[10px] bg-stone p-4">
              <span className="lab text-[10px] text-ash">For AI agents</span>
              <code className="break-all font-mono text-xs">/v/{venue.slug}/.well-known/agent-card.json</code>
              <code className="break-all font-mono text-xs">POST /v/{venue.slug}/a2a · message/send</code>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
