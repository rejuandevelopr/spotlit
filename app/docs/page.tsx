import type { Metadata } from "next";
import { PublicHeader } from "@/components/spotlit/PublicHeader";
import { env } from "@/lib/env";
import { MCP_TOOLS } from "@/lib/mcp";

export const metadata: Metadata = { title: "Docs for agents" };

export default function DocsPage() {
  const mcp = `${env.appUrl}/api/mcp`;
  const slug = env.demoSlug;
  const block = "m-0 overflow-x-auto rounded-[14px] bg-ink p-5 font-mono text-[13px] leading-[1.7] text-fog";
  return (
    <div className="min-h-screen bg-stone text-ink">
      <PublicHeader />
      <main className="mx-auto flex max-w-[920px] flex-col gap-10 px-4 pb-24 pt-12 sm:px-8">
        <div className="flex flex-col gap-3">
          <span className="lab text-ash">For agents and developers</span>
          <h1 className="serif m-0 text-[clamp(48px,6vw,76px)] leading-none">Connect your assistant.</h1>
          <p className="m-0 text-[17px] leading-relaxed text-ash-2">
            Every venue on Spotlit has a real A2A agent. An MCP server lets Claude, Gemini or any MCP client find venues by taste with Qloo data. Calls from outside agents land live in the venue&apos;s inbox.
          </p>
        </div>
        <section className="flex flex-col gap-4">
          <h2 className="serif m-0 text-4xl">MCP</h2>
          <p className="m-0 text-ash-2">Streamable HTTP, stateless, JSON responses. No auth needed for the public tools.</p>
          <pre className={block}>{`# Claude Code
claude mcp add --transport http spotlit ${mcp}

# Claude Desktop, claude_desktop_config.json
{
  "mcpServers": {
    "spotlit": { "url": "${mcp}" }
  }
}`}</pre>
          <div className="flex flex-col gap-3">
            {MCP_TOOLS.map((t) => (
              <div key={t.name} className="card gap-2 p-5">
                <code className="font-mono text-sm font-semibold">{t.name}</code>
                <p className="m-0 text-sm text-ash-2">{t.description}</p>
                <pre className="m-0 overflow-x-auto rounded-lg bg-stone p-3 font-mono text-[12px]">{JSON.stringify(t.inputSchema.properties, null, 2)}</pre>
              </div>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="serif m-0 text-4xl">A2A</h2>
          <p className="m-0 text-ash-2">Each venue publishes an agent card (A2A v0.3) and a JSON-RPC 2.0 endpoint that supports message/send. Unclaimed venues answer as proxies from public Qloo data only.</p>
          <pre className={block}>{`curl ${env.appUrl}/v/${slug}/.well-known/agent-card.json

curl -X POST ${env.appUrl}/v/${slug}/a2a \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send",
       "params":{"message":{"role":"user","messageId":"m1",
       "parts":[{"kind":"text","text":"Table for two Friday at 9?"}]}}}'`}</pre>
          <p className="m-0 text-sm text-ash-2">
            Replies contain a text part (the pitch) and a data part with <code className="font-mono">fits</code>, <code className="font-mono">availability</code> (open, closed or unknown), <code className="font-mono">priceFit</code>, <code className="font-mono">factsUsed</code> and <code className="font-mono">bookingLink</code>. Availability and price are computed from the venue&apos;s card, never invented.
          </p>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="serif m-0 text-4xl">Scoring</h2>
          <pre className={block}>{`score = 0.60 × A + 0.25 × C + 0.15 × Q
A = Qloo taste affinity, normalised within the candidate set
C = fit for the plan: open at the slot, price band, party size, occasion
Q = answer quality: specific, honest about unknowns, bookable`}</pre>
        </section>
      </main>
    </div>
  );
}
