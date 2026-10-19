import { VenueSidebar } from "@/components/app/VenueSidebar";
import { pageOwnerVenue } from "@/lib/guard";
import { listOwnerVenues } from "@/lib/venues";

export default async function VenueDashLayout({ children, params }: { children: React.ReactNode; params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const { user, venue } = await pageOwnerVenue(venueId);
  const others = (await listOwnerVenues(user.uid)).filter((v) => v.id !== venue.id).map((v) => ({ id: v.id, name: v.name }));
  return (
    <div className="flex min-h-screen flex-wrap bg-stone text-ink lg:flex-nowrap">
      <VenueSidebar
        base={`/app/v/${venue.id}`}
        others={others}
        venue={{
          id: venue.id,
          name: venue.name,
          slug: venue.slug,
          place: venue.neighborhood ?? venue.city,
          claimed: venue.isClaimed,
          readiness: venue.readiness,
        }}
      />
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-4 pb-20 pt-10 sm:px-[clamp(16px,3vw,48px)]">{children}</main>
    </div>
  );
}
