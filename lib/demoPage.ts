import { ensureDemo } from "@/lib/demo";
import { getVenue } from "@/lib/venues";
import { getRun } from "@/lib/arena/engine";

/** Loads the public demo (seeding it first in mock mode). Returns null while it is not ready. */
export async function demoContext() {
  const meta = await ensureDemo();
  if (!meta || meta.status !== "ready" || !meta.baselineRunId) return { ready: false as const, meta };
  const [venue, baseline, whatIf] = await Promise.all([getVenue(meta.venueId), getRun(meta.baselineRunId), meta.whatIfRunId ? getRun(meta.whatIfRunId) : Promise.resolve(null)]);
  if (!venue || !baseline) return { ready: false as const, meta };
  return { ready: true as const, meta, venue, baseline, whatIf };
}
