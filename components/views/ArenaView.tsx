import Link from "next/link";
import { AgentGlyph } from "@/components/spotlit/Brand";
import { ProxyLabel, SimulationNote } from "@/components/spotlit/Badges";
import { fmtDate, runLabel } from "@/lib/format";
import { WEIGHTS } from "@/lib/arena/scoring";
import type { Rival, RunDoc, Venue } from "@/lib/types";
import { PageHeader } from "./PageHeader";
import { StartRunButton } from "./ArenaStart";

export function ArenaView({ venue, runs, rivals, options, base, readOnly, disabledReason }: { venue: Venue; runs: RunDoc[]; rivals: Rival[]; options: number[]; base: string; readOnly: boolean; disabledReason: string | null }) {
  return (
    <>
      <PageHeader
        label={`${venue.name} · Agent Arena`}
        title={<>Test your agent against <em className="text-signal-text">rivals</em>.</>}
        desc="Persona agents built from Qloo taste segments ask a concierge agent for a night out. The concierge scores every venue with Qloo, asks the top venue agents over A2A and picks one. It is a simulation, with the scoring shown openly."
      />
      <div className="flex flex-wrap gap-4">
        <section className="card flex-[3_1_480px]">
          <span className="lab text-ash">{readOnly ? "How runs work" : "New run"}</span>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5 text-sm"><AgentGlyph kind="venue" />{venue.name} <span className="text-ash">· your agent card v{venue.latestCardVersion}</span></div>
            {rivals.slice(0, 5).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2.5 text-sm text-ash-2">
                <AgentGlyph kind="proxy" />
                {r.name}
                <ProxyLabel />
              </div>
            ))}
            {!rivals.length && <p className="m-0 text-sm text-ash">Rivals are found automatically from Qloo when the run starts.</p>}
          </div>
          {!readOnly && <StartRunButton venueId={venue.id} options={options} disabled={disabledReason} />}
        </section>
        <section className="flex flex-[2_1_320px] flex-col gap-3 self-start rounded-[14px] bg-ink p-6 text-white">
          <span className="lab text-[11px] text-smoke">How the concierge scores</span>
          {[
            ["Qloo taste affinity", WEIGHTS.A],
            ["Fit for the plan", WEIGHTS.C],
            ["Answer quality", WEIGHTS.Q],
          ].map(([k, w]) => (
            <div key={String(k)} className="flex justify-between text-sm">
              <span>{k}</span>
              <span className="lab text-xs">{Math.round(Number(w) * 100)}%</span>
            </div>
          ))}
          <p className="m-0 text-xs leading-relaxed text-smoke">Same seed, same personas. A what if run changes only your card, so the lift is measured, not guessed.</p>
          <SimulationNote dark />
        </section>
      </div>
      <section className="card">
        <span className="lab text-ash">Runs</span>
        {runs.length === 0 && <p className="m-0 text-sm text-ash">No runs yet.</p>}
        <div className="scroll-box">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            {runs.length > 0 && (
              <thead>
                <tr className="lab text-[10px] text-ash">
                  <th className="pb-2 font-normal">Run</th>
                  <th className="pb-2 font-normal">Type</th>
                  <th className="pb-2 font-normal">Date</th>
                  <th className="pb-2 font-normal">Personas</th>
                  <th className="pb-2 font-normal">Share of voice</th>
                  <th className="pb-2" />
                </tr>
              </thead>
            )}
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-t border-line-soft">
                  <td className="py-3 font-semibold">{runLabel(r.number)}</td>
                  <td className="py-3">{r.label === "what-if" ? "What if" : "Baseline"}</td>
                  <td className="py-3 text-ash-2">{fmtDate(r.startedAt)}</td>
                  <td className="py-3">{r.personaCount}</td>
                  <td className="py-3">
                    {r.summary ? (
                      <span className="serif text-2xl">{Math.round(r.summary.soav * 100)}%</span>
                    ) : (
                      <span className="lab text-[11px] text-signal-text">
                        {r.status === "running" ? `${r.progress.done} of ${r.progress.total}` : r.status}
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <Link href={r.summary ? `${base}/report/${r.id}` : `${base}/arena/${r.id}`} className="text-[13px] font-semibold text-signal-text">
                      {r.summary ? "Report" : "Watch live"}
                    </Link>
                    {r.summary && !readOnly && (
                      <Link href={`${base}/arena/${r.id}`} className="ml-4 text-[13px] text-ash-2">
                        Replay
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
