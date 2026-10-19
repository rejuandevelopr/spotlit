import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/api";
import { handleA2A } from "@/lib/a2a/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, x-spotlit-from, x-spotlit-protocol, x-spotlit-tool" };

function agentName(req: Request) {
  const from = req.headers.get("x-spotlit-from");
  if (from) return from.slice(0, 80);
  const ua = req.headers.get("user-agent") ?? "";
  if (/SpotlitConcierge/i.test(ua)) return "Spotlit concierge";
  if (/claude/i.test(ua)) return "Claude agent";
  if (/gemini|google/i.test(ua)) return "Gemini agent";
  if (/python|httpx|aiohttp/i.test(ua)) return "Python A2A client";
  if (/curl/i.test(ua)) return "curl";
  return "External agent";
}

/** A2A JSON-RPC endpoint (message/send). */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const internal = /SpotlitConcierge/.test(req.headers.get("user-agent") ?? "");
  if (!internal && !rateLimit(`a2a:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32029, message: "Rate limited. Try again in a minute." } }, { status: 429, headers: CORS });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  }
  const protocol = req.headers.get("x-spotlit-protocol") === "mcp" ? "mcp" : "a2a";
  const { response } = await handleA2A(slug, body, { fromAgent: agentName(req), protocol, tool: req.headers.get("x-spotlit-tool") ?? undefined });
  return NextResponse.json(response, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return NextResponse.json(
    { message: "This is an A2A JSON-RPC endpoint. POST a message/send request.", agentCard: `/v/${slug}/.well-known/agent-card.json` },
    { headers: CORS },
  );
}
