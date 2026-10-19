// A2A JSON-RPC 2.0 server for venue agents. Supports message/send (non streaming).
import { z } from "zod";
import { db, newId } from "@/lib/store";
import { env } from "@/lib/env";
import { P } from "@/lib/paths";
import { getVenueBySlug, latestCard } from "@/lib/venues";
import { parseIntent } from "@/lib/agents/intent";
import { venueReply } from "@/lib/agents/venue";
import { notify } from "@/lib/notifications";
import type { InboxDoc, VenueReply } from "@/lib/types";

const PartSchema = z.union([
  z.object({ kind: z.literal("text"), text: z.string().max(4000) }).passthrough(),
  z.object({ kind: z.literal("data"), data: z.record(z.unknown()) }).passthrough(),
  z.object({ kind: z.string() }).passthrough(),
]);

const MessageSchema = z
  .object({
    role: z.string().optional(),
    messageId: z.string().optional(),
    contextId: z.string().optional(),
    parts: z.array(PartSchema).min(1).max(20),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough();

const RpcSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string(),
  params: z.object({ message: MessageSchema, metadata: z.record(z.unknown()).optional() }).passthrough().optional(),
});

export type RpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: unknown } };

const rpcError = (id: string | number | null, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

export interface A2AMeta { fromAgent?: string; protocol?: "a2a" | "mcp"; tool?: string }

export async function handleA2A(slug: string, body: unknown, meta: A2AMeta = {}): Promise<{ response: RpcResponse; reply: VenueReply | null; inboxId?: string; venueId?: string }> {
  const parsed = RpcSchema.safeParse(body);
  const rawId = (body as { id?: string | number | null })?.id ?? null;
  if (!parsed.success) return { response: rpcError(rawId, -32600, "Invalid JSON-RPC request"), reply: null };
  const { id = null, method, params } = parsed.data;

  if (method !== "message/send" && method !== "SendMessage") {
    if (method === "tasks/get" || method === "tasks/cancel") return { response: rpcError(id, -32001, "Task not found. This agent replies with messages, not tasks."), reply: null };
    if (method === "message/stream") return { response: rpcError(id, -32004, "Streaming is not supported by this agent."), reply: null };
    return { response: rpcError(id, -32601, `Method not found: ${method}`), reply: null };
  }
  if (!params?.message) return { response: rpcError(id, -32602, "params.message is required"), reply: null };

  const venue = await getVenueBySlug(slug);
  if (!venue) return { response: rpcError(id, -32001, "Venue agent not found"), reply: null };
  const card = await latestCard(venue.id);
  if (!card) return { response: rpcError(id, -32603, "Venue has no agent card yet"), reply: null };

  const text = params.message.parts
    .map((p) => ((p as { kind: string }).kind === "text" ? (p as { text: string }).text : ""))
    .join(" ")
    .trim();
  const data = params.message.parts.find((p) => (p as { kind: string }).kind === "data") as { data?: Record<string, unknown> } | undefined;
  const intent = parseIntent(text);
  const c = (data?.data?.constraints ?? data?.data ?? {}) as Record<string, unknown>;
  const constraints = {
    day: (c.day as typeof intent.day) ?? intent.day,
    time: (c.time as string) ?? intent.time,
    partySize: (c.partySize as number) ?? intent.partySize,
    budget: (c.budget as typeof intent.budget) ?? intent.budget,
    occasion: (c.occasion as string) ?? intent.occasion,
    likes: (Array.isArray(c.likes) ? (c.likes as string[]) : intent.likes).slice(0, 6),
  };

  const runId = (params.message.metadata?.spotlitRunId ?? params.metadata?.spotlitRunId) as string | undefined;
  const reply = await venueReply(venue, card, { text: text || "Tell me about this venue.", constraints }, { useLLM: !runId || env.arenaLlm === "all" });

  let inboxId: string | undefined;
  if (!runId) {
    // Outside arena runs every request lands in the venue inbox.
    const outcome: InboxDoc["outcome"] =
      reply.availability === "closed" || !reply.fits ? "lost" : reply.availability === "unknown" || reply.priceFit === "unknown" ? "unknown" : "answered";
    const item: InboxDoc = {
      id: newId(16),
      protocol: meta.protocol ?? "a2a",
      fromAgent: meta.fromAgent ?? "External agent",
      request: text.slice(0, 500),
      response: reply.pitch.slice(0, 500),
      outcome,
      tool: meta.tool,
      createdAt: Date.now(),
    };
    inboxId = item.id;
    await db().set(P.inboxItem(venue.id, item.id), { ...item }).catch(() => undefined);
    if (outcome === "lost" || outcome === "unknown") {
      await notify(venue.ownerId, {
        kind: "lost_request",
        title: outcome === "lost" ? "An agent request did not fit" : "An agent could not get an answer",
        body: `${item.fromAgent}: "${item.request.slice(0, 90)}"`,
        link: `/app/v/${venue.id}/inbox`,
      });
    }
  }

  const result = {
    kind: "message",
    role: "agent",
    messageId: newId(16),
    contextId: params.message.contextId ?? newId(12),
    parts: [
      { kind: "text", text: reply.pitch },
      { kind: "data", data: { ...reply, venue: { name: venue.name, slug: venue.slug, claimed: venue.isClaimed } } },
    ],
    ...(inboxId ? { metadata: { spotlitInboxId: inboxId } } : {}),
  };
  return { response: { jsonrpc: "2.0", id, result }, reply, inboxId, venueId: venue.id };
}
