import { db } from "@/lib/store";
import { P } from "@/lib/paths";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { searchPlaces } from "@/lib/qloo/endpoints";
import { rankPlaces } from "@/lib/qloo/rank";
import { CATEGORY_LABEL, guessCategory } from "@/lib/venues";
import type { Venue } from "@/lib/types";

export const runtime = "nodejs";

export const GET = handle(async (req: Request) => {
  await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const city = (url.searchParams.get("city") ?? "").trim().slice(0, 80);
  if (q.length < 2) return json({ results: [], evidence: null });
  const r = await searchPlaces(q, city || null, {}, 20);
  const ranked = rankPlaces(q, city || null, r.data, 8);
  const results = await Promise.all(
    ranked.map(async (p) => {
      const existing = (await db().list<Venue>(P.venues(), { where: [["qlooEntityId", "==", p.id]], limit: 1 }))[0];
      const category = guessCategory(`${p.tags.map((t) => t.name).join(" ")} ${p.name}`);
      return {
        qlooId: p.id,
        name: p.name,
        address: p.address,
        neighborhood: p.neighborhood,
        category: CATEGORY_LABEL[category],
        tagCount: p.tags.length,
        tags: p.tags.slice(0, 4).map((t) => t.name),
        venueId: existing?.id ?? null,
        claimed: !!existing?.ownerId,
      };
    }),
  );
  return json({ results, evidence: r.evidence });
});
