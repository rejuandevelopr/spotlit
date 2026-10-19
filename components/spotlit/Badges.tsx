import type { ReasonCode } from "@/lib/types";

export function ReasonCodeBadge({ code, dark = false, small = false }: { code: ReasonCode; dark?: boolean; small?: boolean }) {
  return (
    <span
      className={`code-chip ${small ? "text-[10px]" : ""}`}
      style={dark ? { color: "#F26A3F", borderColor: "#5A2A1A" } : { color: "#0B0B0C", borderColor: "#0B0B0C" }}
    >
      {code}
    </span>
  );
}

/** Measured lifts are solid, estimated lifts are dashed. */
export function LiftBadge({ lift, type }: { lift: number; type: "measured" | "estimated" }) {
  const sign = lift > 0 ? "+" : "";
  return type === "measured" ? (
    <span className="lab inline-flex items-center gap-1 rounded-md bg-signal px-2 py-1 text-[10px] text-signal-ink">
      {sign}
      {lift} measured
    </span>
  ) : (
    <span className="lab inline-flex items-center gap-1 rounded-md border border-dashed border-ash px-2 py-1 text-[10px] text-ash-2">
      {sign}
      {lift} estimated
    </span>
  );
}

export function ProxyLabel({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`lab inline-flex items-center gap-1.5 text-[10px] ${dark ? "text-mist" : "text-ash"}`}>
      <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ border: `1.5px dashed ${dark ? "#B9B8B3" : "#6B6A66"}` }} />
      Unclaimed, public data only
    </span>
  );
}

export function SimulationNote({ dark = false }: { dark?: boolean }) {
  return <span className={`lab text-[10px] ${dark ? "text-smoke" : "text-ash"}`}>Simulation · Qloo taste decides 60% of every verdict</span>;
}

export function ReadinessBar({ value, dark = true }: { value: number; dark?: boolean }) {
  return (
    <div className="h-1.5 rounded-full" style={{ background: dark ? "#2E2E31" : "#EDECE7" }}>
      <div className="h-1.5 rounded-full bg-signal" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
