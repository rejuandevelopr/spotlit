import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/api";
import { handleMcp } from "@/lib/mcp";

export const runtime = "nodejs";
export const maxDuration = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, accept, authorization, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "mcp-protocol-version",
};

/** MCP server over Streamable HTTP (stateless, JSON responses). */
export async function POST(req: Request) {
  if (!rateLimit(`mcp:${clientIp(req)}`, 40, 60_000)) {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32029, message: "Rate limited" } }, { status: 429, headers: CORS });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  }
  const out = await handleMcp(body, req.headers.get("user-agent"));
  if (out === null) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(out, { headers: CORS });
}

/** No server initiated stream in stateless mode. */
export async function GET() {
  return new NextResponse("Spotlit MCP server. POST JSON-RPC requests to this URL.", { status: 405, headers: { ...CORS, Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { ...CORS, Allow: "POST" } });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "POST, GET, OPTIONS" } });
}
