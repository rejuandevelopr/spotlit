import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { StepPills } from "@/components/app/StepPills";
import { ClaimForm } from "@/components/app/ClaimForm";
import { pageUser } from "@/lib/guard";
import { CATEGORY_LABEL, getVenue } from "@/lib/venues";

export const metadata: Metadata = { title: "Claim venue" };

export default async function ClaimPage({ params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const user = await pageUser(`/app/new/claim/${venueId}`);
  const venue = await getVenue(venueId);
  if (!venue) notFound();
  if (venue.ownerId === user.uid) redirect(`/app/v/${venue.id}/dna`);
  const tags = (venue.qlooTags.length ? venue.qlooTags : []).map((t) => t.name);
  const claimedByOther = !!venue.ownerId;

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-8 px-4 pb-24 pt-10 sm:px-8">
      <div className="flex max-w-[760px] flex-col gap-3.5">
        <StepPills current={2} />
        <span className="lab text-signal-text">Step 02</span>
        <h1 className="serif m-0 text-[clamp(48px,6vw,80px)] leading-[0.98]">Claim {venue.name}.</h1>
        <p className="m-0 text-[17px] leading-relaxed text-ash-2">
          Claiming turns your venue from a public data proxy into an agent you control. Only one account can own a venue.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <section className="min-w-0 flex-[2_1_380px] overflow-hidden rounded-[14px] bg-ink text-white">
          <div className="relative h-[180px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/halftone-spotlight-hero-1920x1080.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <span className="serif text-4xl leading-none">{venue.name}</span>
              <span className="text-sm text-mist">
                {CATEGORY_LABEL[venue.category]} · {[venue.neighborhood, venue.city].filter(Boolean).join(", ")}
              </span>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 text-[13px]">
                {tags.slice(0, 3).map((t) => (
                  <span key={t} className="rounded-full border border-line-dark-2 px-2.5 py-1">{t}</span>
                ))}
                {tags.length > 3 && <span className="rounded-full border border-line-dark-2 px-2.5 py-1">+{tags.length - 3}</span>}
              </div>
            )}
            <div className="flex items-center gap-2.5 border-t border-line-dark pt-3.5">
              <span className={claimedByOther ? "h-3 w-3 rounded-[2px] bg-signal" : "h-3 w-3 rounded-[2px] border-[1.5px] border-dashed border-mist"} />
              <span className="text-[13px] text-mist">{claimedByOther ? "Already claimed by another account" : "Currently unclaimed, public data only"}</span>
            </div>
          </div>
        </section>
        <ClaimForm venueId={venue.id} venueName={venue.name} claimedByOther={claimedByOther} />
      </div>
    </main>
  );
}
