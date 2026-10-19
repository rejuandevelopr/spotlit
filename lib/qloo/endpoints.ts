import type { EntityRef, Evidence, TagRef } from "@/lib/types";
import { qlooGet, type QlooContext } from "./client";
import {
  entityList,
  parseDemographics,
  parseEntityRefs,
  parseHeatmap,
  parsePlace,
  parseTags,
  tagList,
  type RawPlace,
} from "./parse";

export interface WithEvidence<T> { data: T; evidence: Evidence }

/** A taste signal: Qloo entity ids and/or Qloo tag ids. */
export interface Signal { entities?: string[]; tags?: string[] }

function signalParams(s: Signal) {
  return {
    "signal.interests.entities": s.entities?.length ? s.entities : undefined,
    "signal.interests.tags": s.tags?.length ? s.tags : undefined,
  };
}

export async function searchPlaces(query: string, city: string | null, ctx?: QlooContext, take = 10): Promise<WithEvidence<RawPlace[]>> {
  const q = city && !query.toLowerCase().includes(city.toLowerCase()) ? `${query} ${city}` : query;
  let r = await qlooGet("/search", { query: q, types: "urn:entity:place", take }, ctx);
  let data = entityList(r.data).map(parsePlace).filter((p) => p.id);
  if (!data.length) {
    // Some API versions use filter.type instead of types for search.
    r = await qlooGet("/search", { query: q, "filter.type": "urn:entity:place", take }, ctx);
    data = entityList(r.data).map(parsePlace).filter((p) => p.id);
  }
  return { data, evidence: r.evidence };
}

export async function searchEntities(query: string, types: string[], ctx?: QlooContext, take = 5): Promise<WithEvidence<EntityRef[]>> {
  const r = await qlooGet("/search", { query, types, take }, ctx);
  return {
    data: entityList(r.data)
      .map((e) => {
        const types = Array.isArray(e.types) ? (e.types as string[]) : [];
        return { id: String(e.entity_id ?? e.id ?? ""), name: String(e.name ?? ""), type: String(e.subtype ?? types[0] ?? "") };
      })
      .filter((e) => e.id && e.name),
    evidence: r.evidence,
  };
}

export async function getEntities(ids: string[], ctx?: QlooContext): Promise<WithEvidence<RawPlace[]>> {
  const r = await qlooGet("/entities", { entity_ids: ids }, ctx);
  return { data: entityList(r.data).map(parsePlace), evidence: r.evidence };
}

export async function searchTags(query: string, ctx?: QlooContext, take = 8): Promise<WithEvidence<TagRef[]>> {
  const r = await qlooGet("/v2/tags", { "filter.query": query, take }, ctx);
  return { data: parseTags(tagList(r.data), take), evidence: r.evidence };
}

/** Taste tags that a signal (venue, persona seeds, description tags) is associated with. */
export async function tasteTags(signal: Signal, ctx?: QlooContext, take = 30): Promise<WithEvidence<TagRef[]>> {
  // Ask for extra so we still have enough after dropping noise tags such as credit cards.
  const r = await qlooGet("/v2/insights", { "filter.type": "urn:tag", ...signalParams(signal), take: Math.min(50, take * 2) }, ctx);
  return { data: parseTags(tagList(r.data), take), evidence: r.evidence };
}

export async function cityTags(city: string, ctx?: QlooContext, take = 40): Promise<WithEvidence<TagRef[]>> {
  const r = await qlooGet("/v2/insights", { "filter.type": "urn:tag", "signal.location.query": city, take }, ctx);
  return { data: parseTags(tagList(r.data), take), evidence: r.evidence };
}

export async function demographics(signal: Signal, ctx?: QlooContext) {
  const r = await qlooGet("/v2/insights", { "filter.type": "urn:demographics", ...signalParams(signal) }, ctx);
  return { data: parseDemographics(r.data), evidence: r.evidence };
}

export type CrossDomainType = "artist" | "movie" | "brand" | "tv_show" | "podcast" | "book";

export async function crossDomain(signal: Signal, type: CrossDomainType, ctx?: QlooContext, take = 10): Promise<WithEvidence<EntityRef[]>> {
  const r = await qlooGet("/v2/insights", { "filter.type": `urn:entity:${type}`, ...signalParams(signal), take }, ctx);
  return { data: parseEntityRefs(r.data, type, take), evidence: r.evidence };
}

/** Places in a city ranked by taste similarity to the signal. Used for rivals and the concierge. */
export async function tastePlaces(
  signal: Signal,
  location: string,
  opts: { exclude?: string[]; take?: number } = {},
  ctx?: QlooContext,
): Promise<WithEvidence<RawPlace[]>> {
  const r = await qlooGet(
    "/v2/insights",
    {
      "filter.type": "urn:entity:place",
      "filter.location.query": location,
      ...signalParams(signal),
      "filter.exclude.entities": opts.exclude?.length ? opts.exclude : undefined,
      take: opts.take ?? 12,
    },
    ctx,
  );
  return { data: entityList(r.data).map(parsePlace).filter((p) => p.id), evidence: r.evidence };
}

/** One call scores every candidate place against a persona's seeds. */
export async function scoreCandidates(seeds: string[], candidateIds: string[], ctx?: QlooContext): Promise<WithEvidence<Record<string, number>>> {
  if (!candidateIds.length || !seeds.length) return { data: {}, evidence: { callId: "none", path: "/v2/insights", params: {} } };
  const r = await qlooGet(
    "/v2/insights",
    {
      "filter.type": "urn:entity:place",
      "signal.interests.entities": seeds,
      "filter.results.entities": candidateIds,
      take: candidateIds.length,
    },
    ctx,
  );
  const out: Record<string, number> = {};
  const list = entityList(r.data);
  list.forEach((e, i) => {
    const p = parsePlace(e);
    // If Qloo returns no affinity value we fall back to rank position.
    out[p.id] = p.affinity ?? 1 - i / Math.max(1, list.length);
  });
  return { data: out, evidence: r.evidence };
}

export async function heatmap(signal: Signal, location: string, ctx?: QlooContext) {
  const r = await qlooGet("/v2/insights", { "filter.type": "urn:heatmap", "filter.location.query": location, ...signalParams(signal) }, ctx);
  return { data: parseHeatmap(r.data), evidence: r.evidence };
}

export function signalFor(venue: { qlooEntityId: string | null; descriptionTags: string[] }): Signal {
  if (venue.qlooEntityId) return { entities: [venue.qlooEntityId] };
  return { tags: venue.descriptionTags };
}
