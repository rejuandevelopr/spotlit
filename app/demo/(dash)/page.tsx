import { ReportView } from "@/components/views/ReportView";
import { demoContext } from "@/lib/demoPage";
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import type { RoundDoc } from "@/lib/types";

export const metadata = { title: "Report" };

export default async function DemoReport() {
  const ctx = await demoContext();
  if (!ctx.ready) return null;
  const first = (await db().list<RoundDoc>(P.rounds(ctx.baseline.id), { orderBy: ["index", "asc"], limit: 1 }))[0];
  return <ReportView venue={ctx.venue} run={ctx.baseline} evidence={first?.affinityEvidence ?? null} base="/demo" readOnly canShare={false} />;
}
