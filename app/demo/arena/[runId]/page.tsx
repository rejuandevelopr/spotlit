import { redirect } from "next/navigation";
import { demoContext } from "@/lib/demoPage";

/** Links inside shared views point to /demo/arena/<runId>; map them to the replay page. */
export default async function DemoArenaRun({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const ctx = await demoContext();
  redirect(ctx.ready && ctx.whatIf?.id === runId ? "/demo/arena?run=after" : "/demo/arena");
}
