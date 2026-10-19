import Link from "next/link";
import { EvidenceLink } from "@/components/spotlit/EvidenceLink";
import { Check, Ring } from "@/components/spotlit/Brand";
import { readinessItems } from "@/lib/readiness";
import { timeAgo } from "@/lib/format";
import type { AgentCardDoc, Rival, TasteProfile, Venue } from "@/lib/types";
import { EmptyState, PageHeader } from "./PageHeader";
import { Heatmap } from "./Heatmap";
import { BuildDnaButton } from "./actions";

export function DnaView({ venue, profile, card, rivals, base, readOnly }: { venue: Venue; profile: TasteProfile | null; card: AgentCardDoc | null; rivals: Rival[]; base: string; readOnly: boolean }) {
  if (!profile) {
    return (
      <>
        <PageHeader label={`${venue.name} · Taste DNA`} title={<>Who you <em className="text-signal-text">attract</em>.</>} />
        <EmptyState
          title="Your Taste DNA is not built yet."
          body="Spotlit asks Qloo who your venue attracts across music, film, brands and food, how old your crowd skews, and which venues share your taste. It takes about ten seconds."
          action={readOnly ? null : <BuildDnaButton venueId={venue.id} />}
        />
      </>
    );
  }
  const sizes = [52, 44, 38, 34, 30, 28, 26, 24, 22, 20, 18, 18, 17, 16, 16, 15];
  const maxBand = Math.max(...profile.demographics.map((d) => d.value), 0);
  const items = card ? readinessItems(card.facts, card.voice) : [];
  const readiness = card?.readiness ?? venue.readiness;
  const cols: [string, keyof TasteProfile["affinities"], string][] = [
    ["Artists", "artists", "artists"],
    ["Films", "films", "films"],
    ["Brands", "brands", "brands"],
    ["Dining", "dining", "tags"],
  ];

  return (
    <>
      <PageHeader
        label={`${venue.name} · Taste DNA`}
        title={<>Who you <em className="text-signal-text">attract</em>.</>}
        actions={
          <>
            <span className="lab text-[11px] text-ash">Updated {timeAgo(profile.computedAt)} · {profile.callCount} Qloo calls</span>
            {!readOnly && <BuildDnaButton venueId={venue.id} label="Refresh" subtle />}
            <Link href={`${base}/rivals`} className="btn btn-sm btn-ink">See rivals</Link>
          </>
        }
      />
      <div className="flex flex-wrap gap-4">
        <section className="card flex-[3_1_480px]">
          <div className="flex justify-between">
            <span className="lab text-ash">Taste tags by affinity</span>
            <EvidenceLink evidence={profile.evidence.tags} />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2.5 leading-[1.1]">
            {profile.tags.slice(0, 16).map((t, i) => (
              <span key={t.id} className="serif" style={{ fontSize: sizes[i] ?? 15, color: i === 1 ? "#C9502A" : i % 2 ? "#6B6A66" : undefined }} title={t.affinity !== undefined ? `Affinity ${t.affinity.toFixed(2)}` : undefined}>
                {t.name}
              </span>
            ))}
          </div>
        </section>
        <section className="card flex-[2_1_320px]">
          <div className="flex justify-between">
            <span className="lab text-ash">Crowd skew</span>
            <EvidenceLink evidence={profile.evidence.demographics} />
          </div>
          {profile.demographics.length ? (
            <div className="flex flex-col gap-3">
              {profile.demographics.map((d) => (
                <div key={d.band} className="grid grid-cols-[72px_1fr_40px] items-center gap-3 text-[13px]">
                  <span>{d.band}</span>
                  <div className="h-2.5 rounded-full bg-stone">
                    <div className={`h-2.5 rounded-full ${d.value === maxBand ? "bg-signal" : "bg-ink"}`} style={{ width: `${Math.round(d.value * 100)}%` }} />
                  </div>
                  <span className="lab text-right text-[11px]">{d.value.toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm text-ash">Qloo returned no demographic signal for this venue.</p>
          )}
          <p className="m-0 text-[13px] leading-relaxed text-ash">
            {profile.demographics.length
              ? `Skews ${[...profile.demographics].sort((a, b) => b.value - a.value)[0].band}${profile.genderSkew ? `, ${profile.genderSkew}` : ""}. Relative affinity versus the average.`
              : ""}
          </p>
        </section>
      </div>
      <section className="card">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="lab text-ash">Your crowd also loves</span>
          <EvidenceLink evidence={profile.evidence.artists} />
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
          {cols.map(([label, key, evKey]) => {
            const list = profile.affinities[key].slice(0, 3);
            return (
              <div key={label} className="flex flex-col gap-2.5">
                <span className="flex items-center justify-between">
                  <span className="lab text-[11px] text-signal-text">{label}</span>
                  {key !== "artists" && <EvidenceLink evidence={profile.evidence[evKey]} label="↗" />}
                </span>
                {list.length ? (
                  list.map((e, i) => (
                    <div key={e.id} className={`flex justify-between gap-3 ${i < list.length - 1 ? "border-b border-line-soft pb-2" : ""}`}>
                      <span>{e.name}</span>
                      {e.affinity !== undefined && <span className="lab text-[11px]">{e.affinity.toFixed(2)}</span>}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-ash">No strong signal</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap gap-4">
        <section className="relative min-h-[380px] min-w-0 flex-[3_1_480px] overflow-hidden rounded-[14px] bg-ink text-white">
          {profile.heatmap.length ? (
            <Heatmap cells={profile.heatmap} pins={[{ name: venue.name, lat: venue.lat, lng: venue.lng, me: true }, ...rivals.slice(0, 5).map((r) => ({ name: r.name, lat: r.lat, lng: r.lng }))]} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/halftone-city-heatmap-1920x1080.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-50" />
          )}
          <div className="relative flex flex-wrap justify-between gap-2 p-6">
            <span className="lab text-fog">Where your crowd is</span>
            <EvidenceLink evidence={profile.evidence.heatmap} label="Qloo heatmap ↗" dark />
          </div>
          {!profile.heatmap.length && <p className="relative px-6 text-sm text-mist">No heatmap coverage for this area. Rival pins are on the Rivals page.</p>}
          <div className="absolute bottom-6 left-6 text-[13px] text-fog">Brighter, bigger dots mean stronger taste affinity for your crowd</div>
        </section>
        <section className="card flex-[2_1_320px]">
          <div className="flex items-baseline justify-between">
            <span className="lab text-ash">Agent readiness</span>
            <span className="serif text-5xl leading-none">
              {readiness}
              <span className="text-[22px] text-ash">/100</span>
            </span>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
            {[...items].sort((a, b) => Number(b.done) - Number(a.done)).map((it) => (
              <li key={it.key} className="flex items-center justify-between gap-2.5">
                <span className="flex items-center gap-2.5">
                  {it.done ? <Check /> : <Ring />}
                  {it.label}
                </span>
                {!it.done && !readOnly && (
                  <Link href={`${base}/card#${it.field}`} className="text-[13px] text-signal-text">
                    Add · {it.points} pts
                  </Link>
                )}
                {!it.done && readOnly && <span className="text-[13px] text-ash">{it.points} pts</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
