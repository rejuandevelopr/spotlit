import { notFound } from "next/navigation";
import { ReportView } from "@/components/views/ReportView";
import { demoContext } from "@/lib/demoPage";

export const metadata = { title: "Report" };

export default async function DemoRunReport({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const ctx = await demoContext();
  if (!ctx.ready) return null;
  const run = [ctx.baseline, ctx.whatIf].find((r) => r?.id === runId);
  if (!run) notFound();
  return <ReportView venue={ctx.venue} run={run} evidence={null} base="/demo" readOnly canShare={false} />;
}
