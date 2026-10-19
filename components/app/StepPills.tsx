const STEPS = ["Find", "Claim", "Taste DNA", "Agent card", "Arena"];

export function StepPills({ current }: { current: number }) {
  return (
    <ol className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Setup steps">
      {STEPS.map((s, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "now" : "next";
        return (
          <li
            key={s}
            aria-current={state === "now" ? "step" : undefined}
            className={`lab flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] ${
              state === "now" ? "border-ink bg-ink text-white" : state === "done" ? "border-ink text-ink" : "border-line text-ash"
            }`}
          >
            <span>{String(n).padStart(2, "0")}</span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}
