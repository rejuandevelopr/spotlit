import type { Metadata } from "next";
import { VenueSidebar } from "@/components/app/VenueSidebar";
import { DemoPending } from "@/components/views/DemoPending";
import { demoContext } from "@/lib/demoPage";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: { default: "Demo venue", template: "%s · Demo · Spotlit" } };
export const dynamic = "force-dynamic";

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  const ctx = await demoContext();
  if (!ctx.ready) return <DemoPending status={ctx.meta?.status ?? null} error={ctx.meta?.error} mock={env.mock} />;
  const v = ctx.venue;
  return (
    <div className="flex min-h-screen flex-wrap bg-stone text-ink lg:flex-nowrap">
      <VenueSidebar demo base="/demo" venue={{ id: v.id, name: v.name, slug: v.slug, place: v.neighborhood ?? v.city, claimed: v.isClaimed, readiness: v.readiness }} />
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 px-4 pb-20 pt-6 sm:px-[clamp(16px,3vw,48px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#A9A79F] px-4 py-3 text-[13px] text-ash-2">
          <span>
            <strong className="text-ink">Demo venue, read only.</strong> Halftone House is fictional. Rivals are proxies built from public Qloo data. Every result is a simulation.
          </span>
          <a href="/signup" className="font-semibold text-signal-text">Scan your own venue →</a>
        </div>
        {children}
      </main>
    </div>
  );
}
