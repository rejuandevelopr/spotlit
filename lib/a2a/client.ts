// A2A client used by the concierge. Sends real JSON-RPC over HTTP to the venue's endpoint,
// with an in process path for local speed (A2A_INPROCESS=1, mock mode, scripts).
import { env } from "@/lib/env";
import { newId } from "@/lib/store";
import { agentEndpoint } from "./card";
import { handleA2A, type A2AMeta, type RpcResponse } from "./server";
import type { VenueReply } from "@/lib/types";
import type { VenueAsk } from "@/lib/agents/venue";

export interface A2AExchange { request: unknown; response: RpcResponse | null; reply: VenueReply | null; transport: "http" | "in-process"; inboxId?: string }

function buildRequest(ask: VenueAsk, runId?: string) {
  return {
    jsonrpc: "2.0" as const,
    id: newId(10),
    method: "message/send",
    params: {
      message: {
        role: "user",
        messageId: newId(16),
        parts: [
          { kind: "text", text: ask.text },
          { kind: "data", data: { constraints: ask.constraints } },
        ],
        ...(runId ? { metadata: { spotlitRunId: runId } } : {}),
      },
    },
  };
}

function replyFrom(res: RpcResponse | null): VenueReply | null {
  if (!res || !("result" in res)) return null;
  const parts = (res.result as { parts?: { kind: string; data?: unknown }[] })?.parts ?? [];
  const data = parts.find((p) => p.kind === "data")?.data as VenueReply | undefined;
  return data ?? null;
}

export async function askVenue(slug: string, ask: VenueAsk, opts: { runId?: string; meta?: A2AMeta } = {}): Promise<A2AExchange> {
  const request = buildRequest(ask, opts.runId);
  const inProcess = env.a2aInProcess || env.mock || process.env.SPOTLIT_SCRIPT === "1";
  if (!inProcess) {
    try {
      const res = await fetch(agentEndpoint(slug), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "SpotlitConcierge/1.0",
          ...(opts.meta?.fromAgent ? { "x-spotlit-from": opts.meta.fromAgent.slice(0, 80) } : {}),
          ...(opts.meta?.protocol ? { "x-spotlit-protocol": opts.meta.protocol } : {}),
          ...(opts.meta?.tool ? { "x-spotlit-tool": opts.meta.tool } : {}),
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(30000),
      });
      const json = (await res.json()) as RpcResponse;
      const inboxId = "result" in json ? ((json.result as { metadata?: { spotlitInboxId?: string } })?.metadata?.spotlitInboxId ?? undefined) : undefined;
      return { request, response: json, reply: replyFrom(json), transport: "http", inboxId };
    } catch {
      // Fall through to the in process path so a run never stalls on a network hiccup.
    }
  }
  const { response, reply, inboxId } = await handleA2A(slug, request, opts.meta);
  return { request, response, reply: reply ?? replyFrom(response), transport: "in-process", inboxId };
}
