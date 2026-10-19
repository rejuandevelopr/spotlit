// MCP server (Streamable HTTP, stateless, JSON responses). Implements initialize, ping,
// tools/list and tools/call. Every tool call is logged to the venue inbox.
import { z } from "zod";
import { db, newId } from "@/lib/store";
import { P } from "@/lib/paths";
import { env } from "@/lib/env";
import { askVenue } from "@/lib/a2a/client";
import { agentCardUrl } from "@/lib/a2a/card";
import { getProfile, getVenueBySlug } from "@/lib/venues";
import { runConcierge } from "@/lib/agents/public-concierge";
import type { InboxDoc } from "@/lib/types";

const SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const MCP_TOOLS = [
  {
    name: "find_venue_for_taste",
    title: "Find a venue for a taste",
    description:
      "Find the best independent venues for a person's taste using Qloo taste data. Spotlit asks each venue's own agent over A2A and returns the top 3 with reasons. Results are recommendations, not bookings.",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City, for example New York" },
        likes: { type: "array", items: { type: "string" }, description: "Artists, films, brands or vibes the person loves" },
        occasion: { type: "string", description: "date night, group dinner, solo drink, live music, after work, brunch or late night" },
        budget: { type: "string", enum: ["$", "$$", "$$$"] },
        when: { type: "string", description: "Free text day and time, for example Friday 9pm" },
      },
      required: ["likes"],
    },
  },
  {
    name: "ask_venue",
    title: "Ask a venue agent",
    description: "Ask one venue's agent a question (fit, hours, menu, booking link). Answers come only from the venue's agent card or public Qloo data.",
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Venue slug, for example halftone-house" }, question: { type: "string" } },
      required: ["slug", "question"],
    },
  },
  {
    name: "get_taste_dna",
    title: "Get a venue's Taste DNA",
    description: "Qloo Taste DNA for a venue: taste tags, crowd age skew and cross domain affinities (artists, films, brands).",
    inputSchema: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
  },
] as const;

type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const ok = (id: Rpc["id"], result: unknown) => ({ jsonrpc: "2.0" as const, id: id ?? null, result });
const err = (id: Rpc["id"], code: number, message: string) => ({ jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } });
const text = (t: string, structured?: unknown, isError = false) => ({
  content: [{ type: "text", text: t }],
  ...(structured ? { structuredContent: structured } : {}),
  ...(isError ? { isError: true } : {}),
});

export function agentNameFromUA(ua: string | null) {
  const u = (ua ?? "").toLowerCase();
  if (u.includes("claude-code") || u.includes("claude code")) return "Claude Code (MCP)";
  if (u.includes("claude")) return "Claude (MCP)";
  if (u.includes("gemini")) return "Gemini (MCP)";
  if (u.includes("cursor")) return "Cursor (MCP)";
  if (u.includes("openai") || u.includes("chatgpt")) return "ChatGPT (MCP)";
  return "MCP client";
}

async function logInbox(venueId: string, item: Omit<InboxDoc, "id" | "createdAt" | "protocol">) {
  const id = newId(16);
  await db().set(P.inboxItem(venueId, id), { ...item, id, protocol: "mcp", createdAt: Date.now() }).catch(() => undefined);
}

const FindArgs = z.object({
  city: z.string().max(80).optional(),
  likes: z.array(z.string().max(80)).max(6).default([]),
  occasion: z.string().max(40).optional(),
  budget: z.enum(["$", "$$", "$$$"]).optional(),
  when: z.string().max(80).optional(),
});
const AskArgs = z.object({ slug: z.string().max(80), question: z.string().min(1).max(1000) });
const DnaArgs = z.object({ slug: z.string().max(80) });

async function callTool(name: string, args: unknown, agent: string) {
  if (name === "find_venue_for_taste") {
    const a = FindArgs.parse(args ?? {});
    const textReq = `${a.occasion ?? "Night out"}${a.when ? ` ${a.when}` : ""}${a.city ? ` in ${a.city}` : ""}. We love ${a.likes.join(", ")}.${a.budget ? ` Budget ${a.budget}.` : ""}`;
    const r = await runConcierge({ text: textReq, city: a.city ?? env.demoCity, likes: a.likes, occasion: a.occasion ?? null, budget: a.budget ?? null }, { fromAgent: agent, protocol: "mcp", tool: name });
    const top = r.consulted.slice(0, 3).map((c, i) => ({
      rank: i + 1,
      name: c.name,
      slug: c.slug,
      claimed: !c.isProxy,
      score: c.score,
      scores: { tasteMatch: c.A, fit: c.C, answerQuality: c.Q },
      pitch: c.reply?.pitch ?? null,
      availability: c.reply?.availability ?? "unknown",
      bookingLink: c.reply?.bookingLink ?? null,
      agentCard: agentCardUrl(c.slug),
    }));
    const lines = top.map((t) => `${t.rank}. ${t.name}${t.claimed ? "" : " (unclaimed, public data only)"} score ${t.score.toFixed(2)}. ${t.pitch ?? ""}`);
    return text(
      top.length
        ? `Matched to Qloo: ${[...r.resolvedLikes.map((x) => x.name), ...r.resolvedTags.map((x) => `${x.name} (tag)`)].join(", ") || "no specific tastes"}.\nTop venues by Qloo taste match (weights: taste 0.6, fit 0.25, answer 0.15):\n${lines.join("\n")}`
        : r.message,
      { results: top, resolvedLikes: r.resolvedLikes.map((x) => x.name), resolvedTasteTags: r.resolvedTags.map((x) => x.name) },
    );
  }
  if (name === "ask_venue") {
    const a = AskArgs.parse(args ?? {});
    const venue = await getVenueBySlug(a.slug);
    if (!venue) return text(`No venue agent found for "${a.slug}".`, undefined, true);
    const ex = await askVenue(a.slug, { text: a.question, constraints: {} }, { meta: { fromAgent: agent, protocol: "mcp", tool: name } });
    if (!ex.reply) return text("The venue agent did not answer.", undefined, true);
    return text(`${venue.name}${venue.isClaimed ? "" : " (unclaimed, public data only)"}: ${ex.reply.pitch}`, { venue: venue.name, ...ex.reply });
  }
  if (name === "get_taste_dna") {
    const a = DnaArgs.parse(args ?? {});
    const venue = await getVenueBySlug(a.slug);
    if (!venue) return text(`No venue found for "${a.slug}".`, undefined, true);
    const p = await getProfile(venue.id);
    const summary = p
      ? {
          venue: venue.name,
          tasteTags: p.tags.slice(0, 10).map((t) => t.name),
          crowd: p.demographics,
          artists: p.affinities.artists.map((x) => x.name),
          films: p.affinities.films.map((x) => x.name),
          brands: p.affinities.brands.map((x) => x.name),
          source: "Qloo Insights API",
        }
      : { venue: venue.name, tasteTags: venue.qlooTags.slice(0, 10).map((t) => t.name), source: "Qloo" };
    await logInbox(venue.id, { fromAgent: agent, request: "get_taste_dna", response: `Shared Taste DNA (${summary.tasteTags.length} tags)`, outcome: "answered", tool: name });
    return text(`Taste DNA for ${venue.name}: ${summary.tasteTags.join(", ")}.`, summary);
  }
  return null;
}

export async function handleMcp(body: unknown, ua: string | null): Promise<unknown | null> {
  const agent = agentNameFromUA(ua);
  const one = async (m: Rpc) => {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") return err(null, -32600, "Invalid request");
    const isNotification = m.id === undefined || m.id === null;
    switch (m.method) {
      case "initialize": {
        const requested = String((m.params?.protocolVersion as string) ?? SUPPORTED[0]);
        return ok(m.id, {
          protocolVersion: SUPPORTED.includes(requested) ? requested : SUPPORTED[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "spotlit", title: "Spotlit venue agents", version: "1.0.0" },
          instructions:
            "Spotlit finds independent venues by taste with Qloo data and talks to each venue's own agent over A2A. Use find_venue_for_taste first, then ask_venue for details.",
        });
      }
      case "ping":
        return ok(m.id, {});
      case "tools/list":
        return ok(m.id, { tools: MCP_TOOLS });
      case "tools/call": {
        const name = String(m.params?.name ?? "");
        try {
          const res = await callTool(name, m.params?.arguments, agent);
          if (!res) return err(m.id, -32602, `Unknown tool: ${name}`);
          return ok(m.id, res);
        } catch (e) {
          return ok(m.id, text(`Tool error: ${(e as Error).message}`, undefined, true));
        }
      }
      case "resources/list":
        return ok(m.id, { resources: [] });
      case "prompts/list":
        return ok(m.id, { prompts: [] });
      default:
        if (isNotification || m.method.startsWith("notifications/")) return null;
        return err(m.id, -32601, `Method not found: ${m.method}`);
    }
  };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => one(m as Rpc)))).filter(Boolean);
    return out.length ? out : null;
  }
  return one(body as Rpc);
}
