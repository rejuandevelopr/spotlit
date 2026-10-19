/** Share of Agent Voice gauge: 60 radial rays, lit in proportion, display serif number. */
export function SoavGauge({ value, wins, total, size = 260, dark = false, muted = false }: { value: number; wins?: number; total?: number; size?: number; dark?: boolean; muted?: boolean }) {
  const n = 60;
  const lit = Math.round(Math.max(0, Math.min(1, value)) * n);
  const rayLen = Math.round(size * 0.123);
  const radius = Math.round(size * 0.4);
  const on = muted ? (dark ? "#8E8D88" : "#0B0B0C") : "#F26A3F";
  const off = dark ? "#2E2E31" : "#E3E1DA";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Share of Agent Voice ${Math.round(value * 100)} percent`}>
      {Array.from({ length: n }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-[2px]"
          style={{
            left: "calc(50% - 2px)",
            top: `calc(50% - ${rayLen / 2}px)`,
            width: 4,
            height: rayLen,
            background: i < lit ? on : off,
            transform: `rotate(${(360 / n) * i}deg) translateY(-${radius}px)`,
          }}
        />
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="serif leading-none" style={{ fontSize: Math.round(size * 0.277) }}>
          {Math.round(value * 100)}%
        </span>
        {wins !== undefined && total !== undefined && (
          <span className={`lab text-[10px] ${dark ? "text-smoke" : "text-ash"}`}>
            {wins} of {total} picks
          </span>
        )}
      </div>
    </div>
  );
}
