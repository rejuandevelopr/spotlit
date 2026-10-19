"use client";

import { useEffect, useState } from "react";
import { Spinner } from "./Spinner";

/**
 * Spinner plus a message that moves through the real steps of a long task, with elapsed seconds,
 * so people can see work is happening during 30 to 60 second Qloo and Gemini calls.
 */
export function LoadingSteps({ steps, every = 4000, size = 16, showTime = true }: { steps: string[]; every?: number; size?: number; showTime?: boolean }) {
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => setSecs(Math.floor((Date.now() - started) / 1000)), 1000);
    const step = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), every);
    return () => {
      clearInterval(tick);
      clearInterval(step);
    };
  }, [steps.length, every]);
  return (
    <span className="inline-flex items-center gap-2.5" role="status" aria-live="polite">
      <Spinner size={size} />
      <span>{steps[i]}</span>
      {showTime && secs >= 3 && <span className="tabular-nums opacity-70">{secs}s</span>}
    </span>
  );
}

/** Spinner with a fixed label, for short actions. */
export function Busy({ label, size = 16 }: { label: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5" role="status" aria-live="polite">
      <Spinner size={size} />
      <span>{label}</span>
    </span>
  );
}
