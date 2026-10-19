import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { HttpError, type SessionUser } from "@/lib/auth";
import type { RunDoc } from "@/lib/types";

const DAY = 24 * 60 * 60 * 1000;

/** How many arena runs (baseline and what-if together) one account may start per 24 hours. */
export const runsPerDay = () => Math.max(1, Number(process.env.ARENA_RUNS_PER_DAY || 4));

/**
 * Each run makes many Qloo and Gemini calls, so a public deploy needs a cap per account.
 * The owner set in DEMO_OWNER_EMAIL is not limited.
 */
export async function assertRunQuota(user: SessionUser): Promise<void> {
  const owner = process.env.DEMO_OWNER_EMAIL?.trim().toLowerCase();
  if (owner && user.email?.toLowerCase() === owner) return;
  // One field filter only, so no composite index is needed. The time window is checked in code.
  const runs = await db().list<RunDoc>(P.runs(), { where: [["ownerId", "==", user.uid]], limit: 200 });
  const since = Date.now() - DAY;
  const recent = runs.filter((r) => (r.startedAt ?? 0) >= since);
  if (recent.length >= runsPerDay()) {
    const oldest = Math.min(...recent.map((r) => r.startedAt ?? Date.now()));
    const hours = Math.max(1, Math.ceil((oldest + DAY - Date.now()) / (60 * 60 * 1000)));
    throw new HttpError(429, `You have used your ${runsPerDay()} arena runs for today. Try again in about ${hours} hours, or explore the demo venue.`);
  }
}
