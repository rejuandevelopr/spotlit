import Link from "next/link";
import { SoavGauge } from "@/components/spotlit/Gauge";
import { runLabel } from "@/lib/format";
import type { ActionDoc, RunDoc, Venue } from "@/lib/types";
import { EmptyState, PageHeader } from "./PageHeader";
import { PrintButton } from "./PrintButton";

const WORDS = ["No", "One", "Two", "Three", "Four", "Five"];

export function CompareView({ venue, before, after, actions, base }: { venue: Venue; before: RunDoc | null; after: RunDoc | null; actions: ActionDoc[]; base: string }) {
  if (!before?.summary || !after?.summary) {
    return (
      <>
        <PageHeader label={`${venue.name} · Before and after`} title={<>Measure the <em className="text-signal-text">lift</em>.</>} />
        <EmptyState
          title={after && !after.summary ? "The what if run is still playing." : "No what if run yet."}
          body="Accept the Strategist's card and pitch fixes, then re-run the arena. The same seed and the same personas play again, so the difference is measured, not guessed."
          action={
            after && !after.summary ? (
              <Link href={`${base}/arena/${after.id}`} className="btn btn-signal">Watch it live</Link>
            ) : (
              <Link href={`${base}/strategist`} className="btn btn-signal">Open the Strategist</Link>
            )
          }
        />
      </>
    );
  }
  const b = before.summary;
  const a = after.summary;
  const delta = Math.round(a.soav * 100) - Math.round(b.soav * 100);
  const applied = actions.filter((x) => after.appliedActionIds.includes(x.id));
  const estimated = actions.filter((x) => x.liftType === "estimated" && (x.status === "accepted" || x.status === "proposed"));
  const ratio = b.wins ? a.wins / b.wins : 0;
  const gain = a.wins - b.wins;
  const headline =
    gain <= 0 ? (gain === 0 ? "Same picks, for now" : `${gain} picks`) : ratio >= 1.8 && ratio <= 2.3 ? "Twice the picks" : ratio > 2.3 ? `${ratio.toFixed(1)}x the picks` : `+${gain} picks`;
  return (
    <>
      <PageHeader
        label={`${runLabel(before.number)} vs ${runLabel(after.number)} · Same seed, same ${a.total} personas`}
        title={
          <>
            {WORDS[applied.length] ?? applied.length} {applied.length === 1 ? "fix" : "fixes"}. <em className="text-signal-text">{headline}</em>.
          </>
        }
        actions={
          <>
            <PrintButton />
            <Link href={`${base}/arena/${after.id}`} className="btn btn-sm btn-ink">Watch {runLabel(after.number).toLowerCase()}</Link>
          </>
        }
      />
      <div className="flex flex-wrap items-stretch gap-4">
        <section className="card flex-[1_1_300px] items-center">
          <span className="lab self-start text-ash">Before · {runLabel(before.number)}</span>
          <SoavGauge value={b.soav} wins={b.wins} total={b.total} size={240} muted />
        </section>
        <div className="flex flex-[0_1_120px] flex-col items-center justify-center gap-2.5 p-4">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0B0B0C" strokeWidth="1.6" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span className="serif text-[44px] leading-none text-signal-text">
            {delta >= 0 ? "+" : ""}
            {delta}
          </span>
          <span className="lab text-center text-[10px] text-ash">points</span>
        </div>
        <section className="card flex-[1_1_300px] items-center border-2 border-signal">
          <span className="lab self-start text-signal-text">After · {runLabel(after.number)}</span>
          <SoavGauge value={a.soav} wins={a.wins} total={a.total} size={240} />
        </section>
      </div>
      <div className="flex flex-wrap gap-4">
        <section className="card flex-[3_1_480px]">
          <span className="lab text-ash">Wins by segment</span>
          <div className="flex flex-col gap-4">
            {a.bySegment.map((s) => {
              const pre = b.bySegment.find((x) => x.segmentId === s.segmentId);
              const bp = pre?.n ? (pre.wins / pre.n) * 100 : 0;
              const ap = s.n ? (s.wins / s.n) * 100 : 0;
              const d = s.wins - (pre?.wins ?? 0);
              return (
                <div key={s.segmentId} className="grid grid-cols-[minmax(110px,180px)_1fr_64px] items-center gap-4">
                  <span className="text-[15px] font-medium">{s.name}</span>
                  <div className="flex flex-col gap-1">
                    <div className="h-2 rounded bg-stone"><div className="h-2 rounded bg-[#A9A79F]" style={{ width: `${bp}%` }} /></div>
                    <div className="h-2 rounded bg-stone"><div className="h-2 rounded bg-signal" style={{ width: `${ap}%` }} /></div>
                  </div>
                  <span className="lab text-right text-xs">{d >= 0 ? "+" : ""}{d}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-5 text-[13px] text-ash">
            <span className="flex items-center gap-2"><span className="h-2 w-4 rounded bg-[#A9A79F]" />{runLabel(before.number)}</span>
            <span className="flex items-center gap-2"><span className="h-2 w-4 rounded bg-signal" />{runLabel(after.number)}</span>
          </div>
        </section>
        <section className="card flex-[2_1_340px]">
          <span className="lab text-ash">What moved it</span>
          <div className="flex flex-col gap-3">
            {applied.map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-b border-line-soft pb-3">
                <span className="flex-1 text-sm">{x.title}</span>
                <span className="serif text-[26px]">{(x.measuredLift ?? 0) >= 0 ? "+" : ""}{x.measuredLift ?? 0}</span>
                <span className="lab rounded-md bg-ink px-2 py-0.5 text-[10px] text-white">Measured</span>
              </div>
            ))}
            {estimated.map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-b border-line-soft pb-3 text-ash last:border-0">
                <span className="flex-1 text-sm">{x.title}</span>
                <span className="serif text-[26px]">+{x.estLift}</span>
                <span className="lab rounded-md border border-dashed border-ink px-2 py-0.5 text-[10px] text-ink">Estimated</span>
              </div>
            ))}
          </div>
          <p className="m-0 text-[13px] leading-relaxed text-ash">
            Measured lifts come from re-running the same personas; when several fixes ship together the total ({a.wins - b.wins >= 0 ? "+" : ""}{a.wins - b.wins} picks) is split by each fix&apos;s projected share. Estimated lifts use Qloo tag affinity and are not counted in the {Math.round(a.soav * 100)}%.
          </p>
        </section>
      </div>
    </>
  );
}
