// Seeds the fictional demo venue, Halftone House, with a baseline run, the strategist's
// measured fixes and a what-if run with the same personas. Used by scripts/seed-demo.ts and,
// in mock mode, automatically on first visit to /demo.
import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { env } from "@/lib/env";
import { upsertUser } from "@/lib/auth";
import { buildProfile, claimVenue, createVenue, describeToTags, findRivals, getVenueBySlug } from "@/lib/venues";
import { createRun, drive, getRun } from "@/lib/arena/engine";
import { applyActions, listActions } from "@/lib/agents/strategist";
import { emptyFacts, type CardFacts, type RunDoc, type Venue } from "@/lib/types";

export const DEMO_OWNER = { uid: "demo-owner", name: "Dana Park", email: "dana@halftone.example", photoURL: null };
export const DEMO_SEED = 20261030;

export interface DemoMeta { venueId: string; baselineRunId: string | null; whatIfRunId: string | null; status: "seeding" | "ready" | "failed"; updatedAt: number; error?: string }

export async function getDemoMeta() {
  return db().get<DemoMeta>(P.meta("demo"));
}

const DESCRIPTION = "listening bar, vinyl, hi fi sound, natural wine, small plates, date night, psych soul, city pop";

function baselineFacts(): CardFacts {
  return {
    ...emptyFacts(),
    hours: null, // deliberately missing: the first report shows INFO_GAP
    booking: null, // deliberately missing
    events: [], // deliberately missing
    priceBand: "$$",
    partyMax: 8,
    address: "Fictional demo venue, Williamsburg, Brooklyn",
    dishes: ["Miso butter mushrooms", "Smoked trout rillettes", "Burrata with chili crisp"],
    drinks: ["Skin contact Riesling", "Pet nat by the glass", "Low ABV spritz"],
    music: "Vinyl only. Psych soul, city pop and spiritual jazz on a hi fi system.",
    vibe: "Dim, 40 seats, a listening bar where the record is the main event.",
    rules: ["No laptops after 7pm", "Walk ins welcome at the bar"],
  };
}

export async function seedDemo(opts: { force?: boolean; log?: (s: string) => void } = {}): Promise<DemoMeta> {
  const log = opts.log ?? (() => undefined);
  const existing = await getDemoMeta();
  if (existing?.status === "ready" && !opts.force) return existing;

  await upsertUser(DEMO_OWNER);

  let venue: Venue | null = await getVenueBySlug(env.demoSlug);
  if (venue && opts.force) {
    log("Removing the old demo venue");
    await db().deleteCollection(`venues/${venue.id}/cards`);
    await db().deleteCollection(`venues/${venue.id}/actions`);
    await db().deleteCollection(`venues/${venue.id}/inbox`);
    await db().deleteCollection(`venues/${venue.id}/rivals`);
    await db().delete(P.taste(venue.id));
    await db().delete(P.venue(venue.id));
    await db().delete(P.slug(env.demoSlug));
    venue = null;
  }

  if (!venue) {
    log("Mapping the description to Qloo tags");
    const { tags } = await describeToTags(DESCRIPTION);
    if (!tags.length) throw new Error("Qloo returned no tags for the demo description. Run npm run qloo:smoke to check the key.");
    log(`Creating Halftone House with ${tags.length} Qloo tags`);
    venue = await createVenue(
      {
        name: "Halftone House",
        slug: env.demoSlug,
        city: env.demoCity,
        neighborhood: "Williamsburg",
        category: "bar",
        descriptionTags: tags.map((t) => t.id),
        lat: 40.7139,
        lng: -73.9617,
        address: "Fictional demo venue, Williamsburg, Brooklyn",
        isFictional: true,
      },
      { ...baselineFacts(), tasteTags: tags.slice(0, 8).map((t) => t.name) },
      "Friendly and relaxed.",
    );
  }
  await db().set(P.meta("demo"), { venueId: venue.id, baselineRunId: null, whatIfRunId: null, status: "seeding", updatedAt: Date.now() });

  try {
    await claimVenue(venue.id, DEMO_OWNER.uid, "owner");
    log("Building Taste DNA");
    await buildProfile(venue.id);
    log("Finding taste rivals");
    await findRivals(venue.id);

    log("Running the baseline arena (60 personas)");
    const baseline = await createRun({ venueId: venue.id, ownerId: DEMO_OWNER.uid, label: "baseline", isPublicDemo: true, personaCount: env.maxPersonasDemo, seed: DEMO_SEED });
    await runToEnd(baseline.id, log);

    const actions = (await listActions(venue.id)).filter((a) => a.runId === baseline.id && a.liftType === "measured");
    log(`Applying ${actions.length} measured fixes`);
    const overrides: Record<string, Partial<CardFacts>> = {};
    for (const a of actions) if ("booking" in a.patch) overrides[a.id] = { booking: `${env.appUrl}/v/${env.demoSlug}#book` };
    const applied = await applyActions(venue.id, actions.map((a) => a.id), overrides);

    log("Running the what-if arena with the same personas");
    const whatIf = await createRun({ venueId: venue.id, ownerId: DEMO_OWNER.uid, label: "what-if", parentRunId: baseline.id, isPublicDemo: true, appliedActionIds: applied.applied });
    await runToEnd(whatIf.id, log);

    const meta: DemoMeta = { venueId: venue.id, baselineRunId: baseline.id, whatIfRunId: whatIf.id, status: "ready", updatedAt: Date.now() };
    await db().set(P.meta("demo"), { ...meta });
    return meta;
  } catch (err) {
    await db().set(P.meta("demo"), { venueId: venue.id, baselineRunId: null, whatIfRunId: null, status: "failed", updatedAt: Date.now(), error: (err as Error).message });
    throw err;
  }
}

async function runToEnd(runId: string, log: (s: string) => void) {
  let last = -1;
  for (let i = 0; i < 400; i++) {
    const done = await drive(runId, 20_000);
    const run = await getRun(runId);
    if (run && run.progress.done !== last) {
      last = run.progress.done;
      log(`  ${run.progress.done} of ${run.progress.total} rounds`);
    }
    if (done) {
      const fin = (await getRun(runId)) as RunDoc;
      log(`  Done: ${fin.summary?.wins} of ${fin.summary?.total} picks`);
      return fin;
    }
  }
  throw new Error("Run did not finish");
}

/** Mock mode convenience: seed once, in the background, the first time the demo is opened. */
const g = globalThis as unknown as { __demoSeeding?: Promise<DemoMeta> | null };
export async function ensureDemo(): Promise<DemoMeta | null> {
  const meta = await getDemoMeta();
  if (meta?.status === "ready") return meta;
  if (!env.mock) return meta;
  if (!g.__demoSeeding) {
    g.__demoSeeding = seedDemo({ force: meta?.status === "failed", log: (s) => console.log(`[demo] ${s}`) }).finally(() => {
      g.__demoSeeding = null;
    });
  }
  return meta ?? { venueId: "", baselineRunId: null, whatIfRunId: null, status: "seeding", updatedAt: Date.now() };
}

/**
 * Lets the account named in DEMO_OWNER_EMAIL manage the demo venue (for recording the video
 * and showing live MCP calls in its inbox). Moves ownership of the venue and its runs.
 */
export async function adoptDemoIfOwner(uid: string, email: string) {
  const want = (process.env.DEMO_OWNER_EMAIL || "").trim().toLowerCase();
  if (!want || want !== email.trim().toLowerCase()) return;
  const meta = await getDemoMeta();
  if (!meta?.venueId) return;
  await db().update(P.venue(meta.venueId), { ownerId: uid });
  for (const id of [meta.baselineRunId, meta.whatIfRunId]) if (id) await db().update(P.run(id), { ownerId: uid });
}
