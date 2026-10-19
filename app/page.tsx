import Link from "next/link";
import { ArrowRight, OMark, Wordmark } from "@/components/spotlit/Brand";
import { SoavGauge } from "@/components/spotlit/Gauge";
import { SiteFooter } from "@/components/spotlit/SiteFooter";
import { getDemoData } from "@/lib/queries";
import { env } from "@/lib/env";
import type { ReasonCode } from "@/lib/types";

export const dynamic = "force-dynamic";

const REASON_COPY: Record<ReasonCode, string> = {
  INFO_GAP: "No hours or booking link on your card",
  TASTE_GAP: "Part of the crowd leans to a rival on taste",
  PITCH_GAP: "Replies too generic for the occasion",
  CLOSED: "Closed when people asked",
};

export default async function Landing() {
  const demo = await getDemoData().catch(() => null);
  const base = demo?.baseline?.summary ?? null;
  const after = demo?.whatIf?.summary ?? null;
  const soav = after ?? base;
  const reasons = base ? (Object.entries(base.reasonCodes) as [ReasonCode, number][]).sort((a, b) => b[1] - a[1]) : null;
  const ticker = demo?.ticker ?? [];
  const rivals = demo?.rivalNames ?? ["Side B", "Low Fidelity", "Groove Room", "Needle Drop"];

  return (
    <div className="min-h-screen bg-ink text-white">
      <header className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-6 px-4 py-5 sm:px-8">
        <Wordmark width={132} />
        <nav aria-label="Main" className="hidden flex-wrap gap-7 text-sm md:flex">
          <a href="#how" className="text-mist hover:text-white">How it works</a>
          <a href="#arena" className="text-mist hover:text-white">Agent Arena</a>
          <a href="#agents" className="text-mist hover:text-white">For agents</a>
          <Link href="/concierge" className="text-mist hover:text-white">Concierge</Link>
        </nav>
        <div className="flex flex-wrap gap-2.5">
          <Link className="btn btn-line-dark" href="/signin">Sign in</Link>
          <Link className="btn btn-white" href="/signup">Scan your venue</Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line-dark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/halftone-spotlight-hero-1920x1080.webp" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-95" />
        <div className="lg lg-refract relative mx-auto mb-[150px] mt-[72px] flex w-[calc(100%-32px)] max-w-[1060px] flex-col items-center gap-7 rounded-[32px] px-5 py-9 text-center sm:px-14 sm:py-16">
          <div className="lab flex items-center gap-3 text-signal">
            <span className="pill">01</span>Agent visibility for independent venues
          </div>
          <h1 className="serif m-0 max-w-[1000px] text-[clamp(56px,9vw,128px)] leading-[0.95] tracking-[-0.02em]">
            Get <em className="text-signal">spotlit</em> by agents.
          </h1>
          <p className="m-0 max-w-[640px] text-[19px] leading-relaxed text-fog">
            AI assistants are starting to choose where people eat, drink and go out. Spotlit shows you how often they choose you, why they pick a rival instead, and fixes it with real taste data from Qloo.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link className="btn btn-signal" href="/demo">
              Try the demo venue <ArrowRight />
            </Link>
            <Link className="btn lg text-white" href="/signup">Scan your venue</Link>
          </div>
          <p className="lab m-0 mt-2 text-[11px] text-mist">No login for the demo · Built on Qloo Taste AI, A2A and MCP</p>
        </div>
        <div className="relative mx-auto -mt-[90px] grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 px-4 pb-16 sm:px-8">
          <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-5 text-ink">
            <div className="lab text-[11px] text-ash">Persona request</div>
            <p className="m-0 text-[15px] leading-normal">&ldquo;Somewhere chill for a date Friday, we&apos;re into Khruangbin and natural wine, nothing too pricey.&rdquo;</p>
            <div className="text-[13px] text-ash">Maya, 29 · Brooklyn · $$</div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-5 text-ink">
            <div className="lab text-[11px] text-ash">Concierge asks 5 venue agents</div>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] bg-signal" />Halftone House</span>
                <span className="lab text-[11px]">0.82</span>
              </div>
              {rivals.slice(0, 2).map((n, i) => (
                <div key={n} className="flex justify-between text-ash">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-dashed border-ash" />{n}</span>
                  <span className="lab text-[11px]">{["0.71", "0.64"][i]}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2.5 rounded-[14px] bg-white p-5 text-ink">
            <div className="lab text-[11px] text-signal">Verdict</div>
            <p className="serif m-0 text-[28px] leading-[1.1]">Picked Halftone House</p>
            <div className="text-[13px] leading-normal text-ash">Strong taste match on vinyl and psych soul, open Friday 9pm, inside budget.</div>
          </div>
        </div>
      </section>

      <section className="bg-stone text-ink">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-12 px-4 py-24 sm:px-8 sm:py-[120px]">
          <h2 className="serif m-0 max-w-[760px] text-[clamp(40px,5vw,72px)] leading-none">
            When an assistant picks the bar, does it pick <em className="text-signal-text">yours</em>?
          </h2>
          <p className="m-0 max-w-[420px] text-[17px] leading-relaxed text-ash-2">
            Chains have APIs and ad budgets. Independent venues have a vibe that agents cannot read. Spotlit turns that vibe into taste data agents understand, gives your venue its own agent, and tests it against your rivals.
          </p>
        </div>
      </section>

      <section id="how" className="bg-stone text-ink">
        <div className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-8 sm:pb-[120px]">
          <div className="lab mb-6 text-ash">How it works</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
            {[
              ["Read your Taste DNA", "Qloo maps who your venue attracts across music, film, fashion and food, then finds the rivals agents compare you with.", 0],
              ["Run the Agent Arena", "Sixty persona agents built from real taste segments ask a concierge for a night out. It talks to every venue agent over A2A and picks one.", 120],
              ["Fix what agents miss", "The Growth Strategist explains every lost pick with a reason code and Qloo evidence, applies the fix, and re-runs the arena to measure the lift.", 240],
            ].map(([title, body, rot], i) => (
              <article key={String(title)} className="flex flex-col overflow-hidden rounded-[14px] bg-white">
                <div className="flex h-60 items-center justify-center overflow-hidden bg-ink">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/halftone-orb-1080.webp" alt="" aria-hidden="true" className="h-[220px]" style={{ transform: `rotate(${rot}deg)` }} />
                </div>
                <div className="flex flex-col gap-3 p-6">
                  <span className="pill self-start text-signal-text">0{i + 1}</span>
                  <h3 className="serif m-0 text-[34px] leading-[1.05]">{title}</h3>
                  <p className="m-0 text-[15px] leading-relaxed text-ash-2">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="arena" className="border-t border-line-dark bg-ink">
        <div className="mx-auto flex max-w-[1280px] flex-wrap gap-8 px-4 py-24 sm:px-8 sm:py-[120px]">
          <div className="flex flex-[1_1_340px] flex-col gap-5">
            <div className="lab flex items-center gap-3 text-signal">
              <span className="pill">Live</span>Agent Arena
            </div>
            <h2 className="serif m-0 text-[clamp(40px,5vw,64px)] leading-none">Watch agents decide, in real time.</h2>
            <p className="m-0 text-base leading-relaxed text-mist">Every line is a real JSON-RPC message between agents. Every score traces back to a Qloo call you can open.</p>
            <div className="mt-2 flex flex-col gap-3.5 text-sm text-fog">
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-white" />Persona agent</div>
              <div className="flex items-center gap-3"><OMark size={14} />Concierge agent</div>
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-[2px] bg-signal" />Your venue agent</div>
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-dashed border-mist" />Rival proxy, public data only</div>
            </div>
          </div>
          <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-4 rounded-[14px] border border-line-dark bg-ink-2 p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="lab text-[11px] text-smoke">{demo?.baseline ? `Run ${String(demo.baseline.number).padStart(2, "0")} · ${demo.baseline.personaCount} personas · Brooklyn` : "Run 01 · 60 personas · Brooklyn"}</span>
              <span className="lab text-[11px] text-signal"><span className="pulse-dot">●</span> Simulation replay</span>
            </div>
            <ArenaPreview rivals={rivals.slice(0, 4)} />
            <div className="flex flex-col gap-2 border-t border-line-dark pt-3.5 text-[13px]">
              {(ticker.length ? ticker.slice(0, 3) : [
                { time: "21:04:12", who: "Theo, 34, after work jazz", winner: "Groove Room", won: false, code: "INFO_GAP" as ReasonCode },
                { time: "21:04:09", who: "Maya, 29, date night", winner: "Halftone House", won: true, code: null },
              ]).map((t, i) => (
                <div key={i} className="flex flex-wrap gap-3">
                  <span className="lab w-[70px] text-[11px] text-ash">{t.time}</span>
                  <span className="text-fog">{t.who}</span>
                  <span className={t.won ? "font-semibold text-white" : "text-smoke"}>→ {t.winner}</span>
                  {t.code && <span className="lab rounded-md border border-[#5A2A1A] px-1.5 py-0.5 text-[10px] text-signal">{t.code}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink">
        <div className="mx-auto grid max-w-[1280px] grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4 px-4 pb-24 sm:px-8 sm:pb-[120px]">
          <div className="flex flex-col items-center gap-4 rounded-[14px] bg-white p-8 text-ink">
            <div className="lab self-start text-ash">Share of Agent Voice</div>
            <SoavGauge value={soav?.soav ?? 0.37} wins={soav?.wins ?? 22} total={soav?.total ?? 60} />
            <div className="text-center text-sm text-ash-2">
              {base && after ? `Up from ${Math.round(base.soav * 100)}% after the strategist's fixes. ` : "Up from 18% after three fixes. "}
              <Link href="/demo/compare" className="text-signal-text">See the lift</Link>
            </div>
          </div>
          <div className="flex flex-col gap-4 rounded-[14px] bg-white p-8 text-ink">
            <div className="lab text-ash">Why agents passed you</div>
            <div className="flex flex-col gap-3.5">
              {(reasons ?? ([["INFO_GAP", 19], ["TASTE_GAP", 14], ["PITCH_GAP", 11], ["CLOSED", 5]] as [ReasonCode, number][])).map(([code, n], i, arr) => (
                <div key={code} className={`flex items-center justify-between gap-3 ${i < arr.length - 1 ? "border-b border-line-soft pb-3.5" : ""}`}>
                  <span className="code-chip text-[12px]">{code}</span>
                  <span className="flex-1 text-sm text-ash-2">{REASON_COPY[code]}</span>
                  <span className="serif text-[30px]">{n}</span>
                </div>
              ))}
            </div>
            <div className="lab text-[11px] text-ash">{base ? "From the demo venue's baseline simulation, Halftone House" : "Sample data from the demo venue, Halftone House"}</div>
          </div>
        </div>
      </section>

      <section id="agents" className="bg-stone text-ink">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-12 px-4 py-24 sm:px-8 sm:py-[120px]">
          <div className="flex flex-[1_1_380px] flex-col gap-5">
            <div className="lab text-ash">For agents and developers</div>
            <h2 className="serif m-0 text-[clamp(40px,5vw,64px)] leading-none">Every venue gets a real agent.</h2>
            <p className="m-0 text-base leading-relaxed text-ash-2">A public A2A agent card and JSON-RPC endpoint per venue, plus an MCP server so Claude, Gemini or any assistant can find venues by taste.</p>
            <div className="flex flex-wrap gap-2.5">
              {["A2A", "MCP", "JSON-RPC 2.0", "Qloo Insights"].map((t) => (
                <span key={t} className="pill text-ink">{t}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href={`/v/${env.demoSlug}/.well-known/agent-card.json`} className="font-semibold text-signal-text">See an agent card</Link>
              <Link href="/docs" className="font-semibold text-signal-text">Connect your assistant</Link>
            </div>
          </div>
          <pre className="m-0 min-w-0 flex-[1_1_460px] overflow-x-auto rounded-[14px] bg-ink p-7 font-mono text-[13px] leading-[1.7] text-fog">
            <span className="text-smoke">{"// claude_desktop_config.json"}</span>
            {`
{
  "mcpServers": {
    "spotlit": {
      "url": "`}
            <span className="text-signal">{`${env.appUrl}/api/mcp`}</span>
            {`"
    }
  }
}

`}
            <span className="text-smoke">{"// tools"}</span>
            {`
find_venue_for_taste
ask_venue
get_taste_dna`}
          </pre>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function ArenaPreview({ rivals }: { rivals: string[] }) {
  const right = [rivals[0], rivals[1], "Halftone", rivals[2], rivals[3]].filter(Boolean) as string[];
  const ys = [11.8, 30.9, 50, 69.1, 88.2];
  return (
    <div className="relative h-[340px]" aria-hidden="true">
      <svg viewBox="0 0 600 340" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <g stroke="#2E2E31" strokeWidth="1" fill="none">
          {[50, 110, 170, 230, 290].map((y) => (
            <path key={y} d={`M60 ${y} L300 170`} />
          ))}
          {[40, 105, 235, 300].map((y) => (
            <path key={y} d={`M300 170 L540 ${y}`} />
          ))}
        </g>
        <path d="M60 110 L300 170" stroke="#F26A3F" strokeWidth="1.5" fill="none" className="dash-flow" />
        <path d="M300 170 L540 170" stroke="#F26A3F" strokeWidth="2" fill="none" />
        <circle cx="180" cy="140" r="3" fill="#F26A3F" />
        <circle cx="420" cy="170" r="3" fill="#F26A3F" />
        <circle cx="460" cy="122" r="2.5" fill="#B9B8B3" />
      </svg>
      {[14.7, 32.3, 50, 67.6, 85.3].map((t, i) => (
        <div
          key={t}
          className="absolute rounded-full bg-white"
          style={{ left: "10%", top: `${t}%`, transform: "translate(-50%,-50%)", width: i === 1 ? 14 : 12, height: i === 1 ? 14 : 12, boxShadow: i === 1 ? "0 0 0 6px rgba(242,106,63,.25)" : undefined }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-line-dark-2 bg-ink">
        <OMark size={40} />
      </div>
      {right.map((name, i) => {
        const me = name === "Halftone";
        return (
          <div key={name + i} className={`absolute right-0 flex -translate-y-1/2 items-center gap-2 text-xs ${me ? "font-semibold text-white" : "text-mist"}`} style={{ top: `${ys[i]}%` }}>
            <span className={me ? "h-4 w-4 rounded-[3px] bg-signal" : "h-3.5 w-3.5 rounded-[3px] border-[1.5px] border-dashed border-mist"} />
            {name}
          </div>
        );
      })}
    </div>
  );
}
