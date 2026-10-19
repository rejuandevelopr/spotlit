import Link from "next/link";
import { OMark } from "@/components/spotlit/Brand";
import { SoavGauge } from "@/components/spotlit/Gauge";
import { EvidenceLink } from "@/components/spotlit/EvidenceLink";
import { SimulationNote } from "@/components/spotlit/Badges";
import { fmtDate, runLabel } from "@/lib/format";
import { WEIGHTS } from "@/lib/arena/scoring";
import type { Evidence, ReasonCode, RunDoc, Venue } from "@/lib/types";
import { PageHeader } from "./PageHeader";
import { ShareButton } from "./actions";

const REASON_LONG: Record<ReasonCode, string> = {
  INFO_GAP: "Your agent said “unknown” for hours or price",
  TASTE_GAP: "A rival matched the persona's taste better",
  PITCH_GAP: "Your reply was vaguer than the winner's",
  CLOSED: "Closed at the requested time",
};

export function ReportView({
  venue,
  run,
  evidence,
  base,
  readOnly,
  canShare,
}: {
  venue: Venue;
  run: RunDoc;
  evidence: Evidence | null;
  base: string | null;
  readOnly: boolean;
  canShare: boolean;
}) {
  const s = run.summary;
  if (!s) {
    return (
      <PageHeader
        label={`${runLabel(run.number)} · in progress`}
        title="This run is still playing."
        actions={base ? <Link href={`${base}/arena/${run.id}`} className="btn btn-signal">Watch it live</Link> : undefined}
      />
    );
  }
  const top = s.lostTo[0];
  const topShare = top ? Math.round((top.losses / s.total) * 100) : 0;
  const codes = (Object.entries(s.reasonCodes) as [ReasonCode, number][]).sort((a, b) => b[1] - a[1]);
  const segEvidence = run.segments[0]?.evidence ?? null;

  return (
    <>
      <PageHeader
        label={`${runLabel(run.number)} · ${run.label === "what-if" ? "What if" : "Baseline"} · ${s.total} personas · ${fmtDate(run.startedAt)}`}
        title={
          <>
            Agents picked you <em className="text-signal-text">{s.wins} {s.wins === 1 ? "time" : "times"}</em> out of {s.total}.
          </>
        }
        actions={
          <>
            {canShare && <ShareButton runId={run.id} />}
            {base && !readOnly && (
              <Link href={`${base}/strategist`} className="btn btn-sm btn-signal">
                Fix it with the Strategist
              </Link>
            )}
            {base && readOnly && (
              <Link href={`${base}/strategist`} className="btn btn-sm btn-signal">
                See the fixes
              </Link>
            )}
          </>
        }
      />
      <div className="flex flex-wrap gap-4">
        <section className="card flex-[1_1_340px] items-center">
          <div className="flex justify-between self-stretch">
            <span className="lab text-ash">Share of Agent Voice</span>
            <EvidenceLink evidence={evidence} label="Trace ↗" />
          </div>
          <SoavGauge value={s.soav} wins={s.wins} total={s.total} size={280} />
          <p className="m-0 text-center text-sm text-ash-2">{top ? `Top rival ${top.name} took ${topShare}%.` : "No rival beat you."}</p>
        </section>
        <section className="card flex-[2_1_480px]">
          <div className="flex justify-between">
            <span className="lab text-ash">Win rate by taste segment</span>
            <EvidenceLink evidence={segEvidence} />
          </div>
          <div className="flex flex-col gap-4">
            {s.bySegment.map((seg) => {
              const pct = seg.n ? Math.round((seg.wins / seg.n) * 100) : 0;
              return (
                <div key={seg.segmentId} className="grid grid-cols-[minmax(110px,200px)_1fr_84px] items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[15px] font-medium">{seg.name}</span>
                    <span className="text-xs text-ash">{seg.n} personas</span>
                  </div>
                  <div className="h-3.5 rounded-full bg-stone">
                    <div className={`h-3.5 rounded-full ${pct > 30 ? "bg-signal" : "bg-ink"}`} style={{ width: `${Math.max(pct, 1)}%` }} />
                  </div>
                  <span className="lab text-right text-xs">
                    {seg.wins} · {pct}%
                  </span>
                </div>
              );
            })}
          </div>
          <p className="lab m-0 text-[10px] text-ash">Segments built from {run.city} taste tags, weighted by Qloo affinity</p>
        </section>
      </div>
      <div className="flex flex-wrap gap-4">
        <section className="card flex-[3_1_480px]">
          <span className="lab text-ash">Who you lost to</span>
          <div className="scroll-box">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead>
                <tr className="lab text-[10px] text-ash">
                  <th className="pb-2 font-normal">Rival</th>
                  <th className="pb-2 font-normal">Losses</th>
                  <th className="pb-2 font-normal">Main reason</th>
                  <th className="pb-2 font-normal">Segment hit hardest</th>
                </tr>
              </thead>
              <tbody>
                {s.lostTo.map((l) => (
                  <tr key={l.venueId} className="border-t border-line-soft">
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-dashed border-ash" />
                        {l.name}
                      </span>
                    </td>
                    <td className="serif py-3 text-[26px]">{l.losses}</td>
                    <td className="py-3">{l.mainReason && <span className="code-chip">{l.mainReason}</span>}</td>
                    <td className="py-3 text-ash-2">{l.topSegment}</td>
                  </tr>
                ))}
                {!s.lostTo.length && (
                  <tr>
                    <td colSpan={4} className="py-3 text-ash">You won every round.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card flex-[2_1_340px]">
          <span className="lab text-ash">Reason codes</span>
          <div className="flex flex-col gap-3.5">
            {codes.map(([code, n]) => (
              <div key={code} className="flex items-center gap-3">
                <span className="code-chip">{code}</span>
                <span className="flex-1 text-sm text-ash-2">{REASON_LONG[code]}</span>
                <span className="serif text-[30px]">{n}</span>
              </div>
            ))}
          </div>
          <p className="lab m-0 text-[10px] text-ash">Each loss counted once, under its biggest gap</p>
        </section>
      </div>
      <section className="flex flex-wrap gap-8 rounded-[14px] bg-ink p-6 text-white sm:p-8">
        <div className="flex flex-[2_1_420px] flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <OMark size={22} />
            <span className="lab text-[11px] text-signal">Analyst summary</span>
          </div>
          <p className="serif m-0 text-[clamp(24px,2.4vw,30px)] leading-[1.25]">{run.analyst?.narrative ?? "The analyst is still writing."}</p>
          {run.analyst?.patterns?.length ? (
            <ol className="m-0 flex flex-col gap-2.5 pl-5 text-[15px] leading-relaxed text-fog">
              {run.analyst.patterns.map((p, i) => (
                <li key={i}>
                  <strong className="text-white">{p.title}.</strong> {p.detail}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className="flex flex-[1_1_260px] flex-col gap-3 self-start rounded-xl border border-line-dark p-5">
          <span className="lab text-[11px] text-smoke">How the concierge scores</span>
          <div className="flex justify-between text-sm"><span>Qloo taste affinity</span><span className="lab text-xs">{WEIGHTS.A * 100}%</span></div>
          <div className="flex justify-between text-sm"><span>Fit for the plan</span><span className="lab text-xs">{WEIGHTS.C * 100}%</span></div>
          <div className="flex justify-between text-sm"><span>Answer quality</span><span className="lab text-xs">{WEIGHTS.Q * 100}%</span></div>
          <p className="m-0 text-xs leading-relaxed text-smoke">Numbers come from code. The analyst only writes the words.</p>
          <SimulationNote dark />
          {base && (
            <Link href={`${base}/arena/${run.id}`} className="text-[13px] font-semibold text-signal">
              Replay this run →
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
