/** Splits a measured win delta across applied fixes by their projected share. Shares always add up to delta. */
export function splitLift(delta: number, acts: { id: string; estLift: number }[]): Record<string, number> {
  const total = acts.reduce((s, a) => s + a.estLift, 0) || 1;
  const out: Record<string, number> = {};
  let left = delta;
  acts.forEach((a, i) => {
    const share = i === acts.length - 1 ? left : Math.round((delta * a.estLift) / total);
    left -= share;
    out[a.id] = share;
  });
  return out;
}
