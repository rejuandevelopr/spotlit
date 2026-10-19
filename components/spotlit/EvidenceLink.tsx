"use client";

import { useEffect, useState } from "react";
import type { Evidence } from "@/lib/types";

interface Trace {
  path: string;
  params: Record<string, string>;
  ms: number;
  cached: boolean;
  status: number;
  resultCount: number;
  createdAt: number;
  curl: string;
  url: string;
}

/** Mono "Qloo ↗" chip. Opens the trace drawer with the exact Qloo query behind a number. */
export function EvidenceLink({ evidence, label = "Qloo ↗", dark = false }: { evidence: Evidence | null | undefined; label?: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!evidence || evidence.callId === "none") {
    return <span className={`ev ${dark ? "ev-dark" : ""} opacity-60`} title="Computed in code from Qloo data">{label}</span>;
  }
  return (
    <>
      <button type="button" className={`ev ${dark ? "ev-dark" : ""}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </button>
      {open && <QlooTraceDrawer evidence={evidence} onClose={() => setOpen(false)} />}
    </>
  );
}

export function QlooTraceDrawer({ evidence, onClose }: { evidence: Evidence; onClose: () => void }) {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/qloo/trace/${encodeURIComponent(evidence.callId)}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Trace not found");
        if (alive) setTrace(j);
      })
      .catch((e: Error) => alive && setError(e.message));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [evidence.callId, onClose]);

  const params = trace?.params ?? evidence.params;
  const path = trace?.path ?? evidence.path;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Qloo trace">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <aside className="relative h-full w-full max-w-[520px] overflow-y-auto bg-ink p-6 text-white shadow-2xl fade-in">
        <div className="flex items-center justify-between gap-4">
          <span className="lab text-signal">Qloo trace</span>
          <button type="button" onClick={onClose} className="btn btn-sm btn-line-dark">Close</button>
        </div>
        <h2 className="serif mt-6 text-4xl leading-none">
          GET <span className="text-signal">{path}</span>
        </h2>
        <p className="mt-3 text-sm text-mist">The exact query behind this number. Spotlit caches Qloo responses for 7 days and traces every call.</p>
        {error && <p className="mt-4 text-sm text-signal">{error}</p>}
        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          {[
            ["Status", trace ? String(trace.status) : "…"],
            ["Latency", trace ? `${trace.ms} ms` : "…"],
            ["Served from", trace ? (trace.cached ? "Cache" : "Live API") : "…"],
            ["Results", trace ? String(trace.resultCount) : "…"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line-dark p-3">
              <dt className="lab text-[10px] text-smoke">{k}</dt>
              <dd className="mt-1 text-white">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-6">
          <div className="lab text-[11px] text-smoke">Parameters</div>
          <table className="mt-2 w-full text-left font-mono text-[12px]">
            <tbody>
              {Object.entries(params).map(([k, v]) => (
                <tr key={k} className="border-t border-line-dark align-top">
                  <td className="py-2 pr-3 text-signal">{k}</td>
                  <td className="py-2 break-all text-fog">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {trace && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <span className="lab text-[11px] text-smoke">Reproduce it</span>
              <button
                type="button"
                className="ev ev-dark"
                onClick={() => {
                  void navigator.clipboard.writeText(trace.curl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy curl"}
              </button>
            </div>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-ink-2 p-4 font-mono text-[12px] leading-relaxed text-fog whitespace-pre-wrap break-all">{trace.curl}</pre>
          </div>
        )}
      </aside>
    </div>
  );
}
