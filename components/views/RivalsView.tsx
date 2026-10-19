import Link from "next/link";
import { EvidenceLink } from "@/components/spotlit/EvidenceLink";
import { ProxyLabel } from "@/components/spotlit/Badges";
import type { Rival, TasteProfile, Venue } from "@/lib/types";
import { EmptyState, PageHeader } from "./PageHeader";
import { Heatmap } from "./Heatmap";
import { BuildDnaButton } from "./actions";

function km(a: { lat: number | null; lng: number | null }, b: { lat: number | null; lng: number | null }) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function RivalsView({ venue, rivals, profile, base, readOnly }: { venue: Venue; rivals: Rival[]; profile: TasteProfile | null; base: string; readOnly: boolean }) {
  const header = (
    <PageHeader
      label={`${venue.name} · Rivals`}
      title={<>Who agents <em className="text-signal-text">compare</em> you with.</>}
      desc="Venues near you with the most taste overlap. Each gets a proxy agent built only from public Qloo data, so the arena is a fair fight."
      actions={!readOnly && rivals.length ? <Link href={`${base}/arena`} className="btn btn-signal">Run the arena</Link> : undefined}
    />
  );
  if (!rivals.length) {
    return (
      <>
        {header}
        <EmptyState
          title="No rivals yet."
          body="Rivals come from Qloo: places in your area ranked by taste similarity to your venue. Build your Taste DNA and Spotlit finds them."
          action={readOnly ? null : <BuildDnaButton venueId={venue.id} label="Find rivals with Qloo" />}
        />
      </>
    );
  }
  const maxKm = Math.max(0, ...rivals.map((r) => km(venue, r) ?? 0));
  return (
    <>
      {header}
      <div className="flex flex-wrap gap-4">
        <section aria-label="Rival map" className="relative min-h-[520px] min-w-0 flex-[1_1_420px] overflow-hidden rounded-[14px] bg-ink">
          <Heatmap
            cells={profile?.heatmap ?? []}
            height={520}
            pins={[{ name: venue.name, lat: venue.lat, lng: venue.lng, me: true }, ...rivals.map((r) => ({ name: r.name, lat: r.lat, lng: r.lng }))]}
          />
          {!profile?.heatmap.length && rivals.every((r) => r.lat == null) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/brand/halftone-city-heatmap-1920x1080.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-60" />
          )}
          <div className="absolute left-5 top-5 flex gap-2">
            <span className="lab rounded-md bg-ink/70 px-2.5 py-1.5 text-[11px] text-fog">{maxKm ? `${maxKm.toFixed(1)} km radius` : venue.city}</span>
          </div>
        </section>
        <section className="flex min-w-0 flex-[1_1_420px] flex-col gap-1.5 rounded-[14px] bg-white p-6">
          <div className="flex justify-between px-1 pb-3">
            <span className="lab text-ash">{rivals.length} rivals · taste overlap</span>
            <EvidenceLink evidence={rivals[0]?.evidence} />
          </div>
          <div className="flex flex-col">
            {rivals.map((r, i) => {
              const d = km(venue, r);
              const pct = Math.round(r.overlapScore * 100);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3.5 border-t border-line-soft px-1 py-3.5">
                  <span className="serif w-8 text-[28px] text-ash">{i + 1}</span>
                  <div className="flex min-w-[160px] flex-1 flex-col gap-1">
                    <Link href={`/v/${r.slug}`} className="font-semibold text-ink no-underline hover:underline">{r.name}</Link>
                    <span className="text-[13px] text-ash">
                      {r.sharedTags.length ? r.sharedTags.join(", ") : r.address ?? "Public Qloo data"}
                      {d !== null ? ` · ${d.toFixed(1)} km` : ""}
                    </span>
                  </div>
                  <ProxyLabel />
                  <div className="flex w-[120px] flex-col gap-1">
                    <span className="lab text-right text-[11px]">{pct}% overlap</span>
                    <div className="h-1.5 rounded-full bg-stone">
                      <div className="h-1.5 rounded-full bg-ink" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="lab m-0 px-1 pt-3 text-[10px] text-ash">Overlap is Qloo place affinity for your taste signal, in your area</p>
        </section>
      </div>
    </>
  );
}
