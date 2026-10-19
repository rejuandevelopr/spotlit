// Arena run orchestration without a queue service. Rounds are claimed in transactions,
// played in small batches, and runs finalize exactly once.
import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import { env } from "@/lib/env";
import { hashSeed } from "@/lib/rng";
import { sleep } from "@/lib/util";
import { cardVersion, ensureVenueTags, findRivals, getVenue, latestCard, listRivals } from "@/lib/venues";
import { notify } from "@/lib/notifications";
import { buildSegments } from "./segments";
import { buildPersonas } from "./personas";
import { playRound } from "./round";
import { summarize } from "./scoring";
import { runAnalyst } from "@/lib/agents/analyst";
import { generateActions, recordMeasuredLift } from "@/lib/agents/strategist";
import type { AgentCardDoc, Persona, RoundDoc, RunDoc, Venue } from "@/lib/types";

const BATCH = 6;
const STALE_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export interface CreateRunInput {
  venueId: string;
  ownerId: string | null;
  label?: RunDoc["label"];
  parentRunId?: string | null;
  personaCount?: number;
  isPublicDemo?: boolean;
  appliedActionIds?: string[];
  seed?: number;
}

export async function createRun(input: CreateRunInput): Promise<RunDoc> {
  const venue = await getVenue(input.venueId);
  if (!venue) throw new Error("Venue not found");
  const card = await latestCard(venue.id);
  if (!card) throw new Error("Venue has no agent card");

  const parent = input.parentRunId ? await db().get<RunDoc>(P.run(input.parentRunId)) : null;
  let candidateIds: string[];
  let segments = parent?.segments ?? [];
  let personas: Persona[];
  let seed: number;

  if (parent) {
    // What-if: exactly the same personas and rivals, only the card changed.
    candidateIds = parent.candidateIds;
    seed = parent.seed;
    const rounds = await db().list<RoundDoc>(P.rounds(parent.id), { orderBy: ["index", "asc"] });
    personas = rounds.map((r) => r.persona);
  } else {
    let rivals = await listRivals(venue.id);
    if (!rivals.length) rivals = await findRivals(venue.id);
    candidateIds = [venue.id, ...rivals.slice(0, 5).map((r) => r.id)];
    segments = await buildSegments(venue.city, venue.category);
    if (!segments.length) throw new Error("Could not build taste segments from Qloo for this city.");
    seed = input.seed ?? hashSeed(`${venue.id}:${Date.now()}`);
    const max = input.isPublicDemo ? env.maxPersonasDemo : Math.max(env.maxPersonasPublic, 12);
    const count = Math.max(6, Math.min(max, input.personaCount ?? max));
    personas = buildPersonas(seed, segments, count);
  }

  // Make sure every candidate has Qloo taste tags in the tag space we score against.
  for (const id of candidateIds) {
    const v = await getVenue(id);
    if (v) await ensureVenueTags(v);
  }

  const number = (await db().count(P.runs(), { where: [["venueId", "==", venue.id]] })) + 1;
  const run: RunDoc = {
    id: newId(),
    venueId: venue.id,
    venueName: venue.name,
    ownerId: input.ownerId,
    cardVersion: card.version,
    seed,
    number,
    personaCount: personas.length,
    city: venue.city,
    area: venue.neighborhood ?? null,
    status: "running",
    label: input.label ?? (parent ? "what-if" : "baseline"),
    parentRunId: parent?.id ?? null,
    progress: { done: 0, total: personas.length },
    isPublicDemo: !!input.isPublicDemo,
    candidateIds,
    segments,
    summary: null,
    analyst: null,
    appliedActionIds: input.appliedActionIds ?? [],
    startedAt: Date.now(),
    finishedAt: null,
    lastTickAt: null,
    error: null,
  };
  await db().set(P.run(run.id), { ...run });
  await Promise.all(
    personas.map((p, i) => {
      const round: RoundDoc = {
        id: p.id,
        index: i,
        status: "pending",
        attempts: 0,
        lockedAt: null,
        persona: p,
        candidates: [],
        winnerVenueId: null,
        winnerName: null,
        targetWon: false,
        reason: "",
        reasonCodes: [],
        affinityEvidence: null,
        createdAt: Date.now(),
        finishedAt: null,
      };
      return db().set(P.round(run.id, p.id), { ...round });
    }),
  );
  return run;
}

async function loadContext(run: RunDoc) {
  const venues: Venue[] = [];
  const cards = new Map<string, AgentCardDoc>();
  for (const id of run.candidateIds) {
    const v = await getVenue(id);
    if (!v) continue;
    venues.push(v);
    const c = v.id === run.venueId ? ((await cardVersion(v.id, run.cardVersion)) ?? (await latestCard(v.id))) : await latestCard(v.id);
    if (c) cards.set(v.id, c);
  }
  return { run, venues, cards };
}

async function claimRounds(runId: string): Promise<RoundDoc[]> {
  // Recover rounds whose worker died.
  const running = await db().list<RoundDoc>(P.rounds(runId), { where: [["status", "==", "running"]] });
  for (const r of running) {
    if (r.lockedAt && Date.now() - r.lockedAt > STALE_MS) {
      await db().update(P.round(runId, r.id), r.attempts >= MAX_ATTEMPTS ? { status: "failed" } : { status: "pending" });
    }
  }
  const pending = await db().list<RoundDoc>(P.rounds(runId), { where: [["status", "==", "pending"]], orderBy: ["index", "asc"], limit: BATCH });
  const claimed: RoundDoc[] = [];
  for (const r of pending) {
    const ok = await db().transaction(async (tx) => {
      const cur = await tx.get<RoundDoc>(P.round(runId, r.id));
      if (!cur || cur.status !== "pending") return false;
      tx.update(P.round(runId, r.id), { status: "running", lockedAt: Date.now(), attempts: (cur.attempts ?? 0) + 1 });
      return true;
    });
    if (ok) claimed.push(r);
  }
  return claimed;
}

export interface TickResult { claimed: number; done: number; total: number; complete: boolean }

export async function tick(runId: string): Promise<TickResult> {
  const run = await db().get<RunDoc>(P.run(runId));
  if (!run) throw new Error("Run not found");
  if (run.status === "complete" || run.status === "failed") {
    return { claimed: 0, done: run.progress.done, total: run.progress.total, complete: true };
  }
  await db().update(P.run(runId), { lastTickAt: Date.now() });
  const claimed = await claimRounds(runId);
  if (claimed.length) {
    const ctx = await loadContext(run);
    await Promise.all(
      claimed.map(async (r) => {
        try {
          const result = await playRound(ctx, r);
          await db().update(P.round(runId, r.id), { ...result, status: "done", finishedAt: Date.now() });
          await db().update(P.run(runId), { "progress.done": { __op: "increment", by: 1 } });
        } catch (err) {
          console.error(`[arena] round ${r.id} failed`, err);
          const cur = await db().get<RoundDoc>(P.round(runId, r.id));
          const failed = (cur?.attempts ?? 1) >= MAX_ATTEMPTS;
          await db().update(P.round(runId, r.id), { status: failed ? "failed" : "pending", lockedAt: null });
          if (failed) await db().update(P.run(runId), { "progress.done": { __op: "increment", by: 1 } });
        }
      }),
    );
  }
  const open = await db().count(P.rounds(runId), { where: [["status", "in", ["pending", "running"]]] });
  if (open === 0) {
    await finalize(runId);
    const fin = await db().get<RunDoc>(P.run(runId));
    return { claimed: claimed.length, done: fin?.progress.done ?? 0, total: fin?.progress.total ?? 0, complete: true };
  }
  const fresh = await db().get<RunDoc>(P.run(runId));
  return { claimed: claimed.length, done: fresh?.progress.done ?? 0, total: fresh?.progress.total ?? 0, complete: false };
}

/** Keep ticking until the run completes or the time budget runs out. */
export async function drive(runId: string, budgetMs: number): Promise<boolean> {
  const end = Date.now() + budgetMs;
  while (Date.now() < end) {
    const r = await tick(runId);
    if (r.complete) return true;
    if (r.claimed === 0) await sleep(1500);
  }
  return false;
}

export async function finalize(runId: string) {
  // Exactly once: flip running to finalizing in a transaction.
  const won = await db().transaction(async (tx) => {
    const r = await tx.get<RunDoc>(P.run(runId));
    if (!r || r.status !== "running") return false;
    tx.update(P.run(runId), { status: "complete", finishedAt: Date.now() });
    return true;
  });
  if (!won) return;
  const run = (await db().get<RunDoc>(P.run(runId)))!;
  const rounds = await db().list<RoundDoc>(P.rounds(runId), { orderBy: ["index", "asc"] });
  const summary = summarize(rounds, run.segments, run.venueId);
  await db().update(P.run(runId), { summary, progress: { done: rounds.length, total: run.progress.total } });

  const venue = await getVenue(run.venueId);
  let analyst: RunDoc["analyst"] = null;
  try {
    analyst = await runAnalyst({ ...run, summary }, rounds, venue);
  } catch (err) {
    console.warn("[arena] analyst failed", err);
  }
  await db().update(P.run(runId), { analyst });
  if (venue) await db().update(P.venue(venue.id), { latestRunId: runId, latestSoav: summary.soav, setupStep: 5 });

  try {
    if (run.label === "what-if" && run.parentRunId) await recordMeasuredLift({ ...run, summary }, venue);
    else await generateActions({ ...run, summary, analyst }, rounds);
  } catch (err) {
    console.warn("[arena] strategist step failed", err);
  }

  await notify(run.ownerId, {
    kind: "run_finished",
    title: `Run ${String(run.number).padStart(2, "0")} finished for ${run.venueName}`,
    body: `${summary.wins} of ${summary.total} picks (${Math.round(summary.soav * 100)}% Share of Agent Voice).`,
    link: `/app/v/${run.venueId}/report/${runId}`,
  });
}

export async function getRun(runId: string) {
  return db().get<RunDoc>(P.run(runId));
}

export async function listRuns(venueId: string) {
  const rows = await db().list<RunDoc>(P.runs(), { where: [["venueId", "==", venueId]] });
  return rows.sort((a, b) => b.startedAt - a.startedAt);
}
