import { ArenaTheatre } from "@/components/views/ArenaTheatre";
import { DemoPending } from "@/components/views/DemoPending";
import { demoContext } from "@/lib/demoPage";
import { livePayload } from "@/lib/live";
import { env } from "@/lib/env";

export const metadata = { title: "Arena replay · Demo" };
export const dynamic = "force-dynamic";

export default async function DemoArena({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const ctx = await demoContext();
  if (!ctx.ready) return <DemoPending status={ctx.meta?.status ?? null} error={ctx.meta?.error} mock={env.mock} />;
  const { run } = await searchParams;
  const target = run === "after" && ctx.whatIf ? ctx.whatIf : ctx.baseline;
  const initial = await livePayload(target, { all: true });
  return <ArenaTheatre runId={target.id} initial={initial} mode="replay" backHref="/demo" reportHref={run === "after" ? "/demo/compare" : "/demo"} />;
}
