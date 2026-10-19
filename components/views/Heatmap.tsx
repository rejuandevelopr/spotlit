/** Dotted halftone heatmap drawn from Qloo heatmap cells, with HTML pins for venues. */
export function Heatmap({
  cells,
  pins = [],
}: {
  cells: { lat: number; lng: number; v: number }[];
  pins?: { name: string; lat: number | null; lng: number | null; me?: boolean }[];
  height?: number;
}) {
  const placed = pins.filter((p) => p.lat != null && p.lng != null) as { name: string; lat: number; lng: number; me?: boolean }[];
  // Frame the map on the heatmap cells when we have them, otherwise on the pins.
  const frame = cells.length ? cells.map((c) => [c.lat, c.lng]) : placed.map((p) => [p.lat, p.lng]);
  if (!frame.length) return null;
  let minLat = Math.min(...frame.map((p) => p[0]));
  let maxLat = Math.max(...frame.map((p) => p[0]));
  let minLng = Math.min(...frame.map((p) => p[1]));
  let maxLng = Math.max(...frame.map((p) => p[1]));
  const padLat = (maxLat - minLat || 0.01) * 0.06;
  const padLng = (maxLng - minLng || 0.01) * 0.06;
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;
  const xp = (lng: number) => ((lng - minLng) / (maxLng - minLng)) * 100;
  const yp = (lat: number) => 100 - ((lat - minLat) / (maxLat - minLat)) * 100;
  const inside = (p: { lat: number; lng: number }) => p.lat >= minLat && p.lat <= maxLat && p.lng >= minLng && p.lng <= maxLng;
  const maxV = Math.max(0.0001, ...cells.map((c) => c.v));
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {cells.map((c, i) => {
        const t = Math.tanh((c.v / maxV) * 1.6);
        const size = 3 + t * 13;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-signal"
            style={{ left: `${xp(c.lng)}%`, top: `${yp(c.lat)}%`, width: size, height: size, opacity: 0.12 + t * 0.85, transform: "translate(-50%,-50%)" }}
          />
        );
      })}
      {placed.filter(inside).map((p) => (
        <div
          key={p.name}
          className={`absolute flex -translate-y-1/2 items-center gap-2 whitespace-nowrap text-[13px] text-white ${p.me ? "z-10 font-semibold" : ""}`}
          style={{ left: `${Math.min(80, xp(p.lng))}%`, top: `${Math.max(16, Math.min(88, yp(p.lat)))}%` }}
        >
          {p.me ? (
            <span className="h-4 w-4 rounded-[3px] bg-signal" style={{ boxShadow: "0 0 0 6px rgba(242,106,63,.25)" }} />
          ) : (
            <span className="h-3 w-3 rounded-[2px] border-[1.5px] border-dashed border-white bg-ink/60" />
          )}
          <span className="rounded bg-ink/60 px-1">{p.name}</span>
        </div>
      ))}
    </div>
  );
}
