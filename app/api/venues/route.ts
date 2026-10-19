import { z } from "zod";
import { handle, json, parseBody } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { getEntities, searchPlaces } from "@/lib/qloo/endpoints";
import { createVenue, describeToTags, guessCategory, publicFacts, venueForPlace } from "@/lib/venues";
import { emptyFacts, CATEGORIES } from "@/lib/types";

export const runtime = "nodejs";

const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("qloo"), qlooId: z.string().min(1).max(200), name: z.string().max(120).optional(), city: z.string().min(2).max(80) }),
  z.object({
    mode: z.literal("describe"),
    name: z.string().min(2).max(80),
    city: z.string().min(2).max(80),
    neighborhood: z.string().max(80).optional(),
    kind: z.string().min(2).max(120),
    vibe: z.string().max(400).optional(),
    price: z.enum(["$", "$$", "$$$", "$$$$"]).optional(),
    category: z.enum(CATEGORIES).optional(),
  }),
]);

/** Create a venue from a Qloo place or from a description. The user claims it next. */
export const POST = handle(async (req: Request) => {
  await requireUser();
  const body = await parseBody(req, Body);
  if (body.mode === "qloo") {
    let place = (await getEntities([body.qlooId])).data.find((p) => p.id === body.qlooId) ?? null;
    if (!place && body.name) place = (await searchPlaces(body.name, body.city, {}, 5)).data.find((p) => p.id === body.qlooId) ?? null;
    if (!place) throw new HttpError(404, "Qloo could not find that place anymore. Try searching again.");
    const venue = await venueForPlace(place, body.city);
    return json({ venueId: venue.id });
  }
  const text = [body.kind, body.vibe].filter(Boolean).join(", ");
  const { tags } = await describeToTags(text);
  if (!tags.length) throw new HttpError(422, "Qloo could not map that description to taste tags. Try words like listening bar, natural wine or jazz.");
  const facts = { ...emptyFacts(), ...publicFacts(null, tags), priceBand: body.price ?? null, vibe: body.vibe?.trim() || null };
  const venue = await createVenue(
    {
      name: body.name.trim(),
      city: body.city.trim(),
      neighborhood: body.neighborhood?.trim() || null,
      category: body.category ?? guessCategory(text),
      descriptionTags: tags.map((t) => t.id),
      qlooTags: tags,
    },
    facts,
  );
  return json({ venueId: venue.id, tags: tags.map((t) => t.name) });
});
