import { NextResponse } from "next/server";
import { buildAgentCard } from "@/lib/a2a/card";
import { getVenueBySlug, latestCard } from "@/lib/venues";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A2A agent card for a venue (well known path, protocol v0.3). */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return NextResponse.json({ error: "Venue agent not found" }, { status: 404 });
  const card = await latestCard(venue.id);
  return NextResponse.json(buildAgentCard(venue, card), {
    headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" },
  });
}
