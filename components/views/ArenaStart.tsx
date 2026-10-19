"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingSteps } from "@/components/spotlit/Loading";

export function StartRunButton({ venueId, options, disabled }: { venueId: string; options: number[]; disabled?: string | null }) {
  const router = useRouter();
  const [count, setCount] = useState(options[options.length - 1]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/arena", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venueId, personaCount: count }) });
    const j = await r.json();
    if (!r.ok) {
      setError(j.error || "Could not start the run");
      setBusy(false);
      return;
    }
    router.push(`/app/v/${venueId}/arena/${j.runId}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">Personas</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((n) => (
            <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`min-h-10 rounded-full border px-4 text-sm ${count === n ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              {n} personas
            </button>
          ))}
        </div>
      </fieldset>
      {disabled && <p className="m-0 text-sm text-signal-text">{disabled}</p>}
      {error && <p role="alert" className="m-0 text-sm text-signal-text">{error}</p>}
      <button type="button" onClick={start} disabled={busy || !!disabled} className="btn btn-signal self-start">
        {busy ? (
          <LoadingSteps
            every={5000}
            steps={["Reading city taste segments from Qloo…", "Building personas from real artists and films…", "Asking rival venues for their agent cards…", "Starting the arena…"]}
          />
        ) : (
          "Start the arena"
        )}
      </button>
    </div>
  );
}
