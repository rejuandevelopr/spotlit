"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BuildDnaButton({ venueId, label = "Build Taste DNA", subtle = false }: { venueId: string; label?: string; subtle?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={busy}
        className={subtle ? "btn btn-sm btn-line" : "btn btn-signal"}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await fetch(`/api/venues/${venueId}/profile`, { method: "POST" });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) setError(j.error || "Qloo request failed");
          setBusy(false);
          router.refresh();
        }}
      >
        {busy ? "Asking Qloo…" : label}
      </button>
      {error && (
        <span role="alert" className="absolute right-0 top-full z-10 mt-2 w-max max-w-[min(360px,80vw)] break-words text-right text-sm text-signal-text">
          {error}
        </span>
      )}
    </span>
  );
}

export function ShareButton({ runId }: { runId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="btn btn-sm btn-line bg-white"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await fetch(`/api/arena/${runId}/share`, { method: "POST" });
          const j = await r.json();
          setBusy(false);
          if (r.ok) {
            const full = `${window.location.origin}/r/${j.token}`;
            setUrl(full);
            void navigator.clipboard?.writeText(full).catch(() => undefined);
          }
        }}
      >
        {url ? "Link copied" : busy ? "Creating…" : "Share report"}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="max-w-[220px] truncate text-[13px] text-signal-text">
          {url.replace(/^https?:\/\//, "")}
        </a>
      )}
    </span>
  );
}
