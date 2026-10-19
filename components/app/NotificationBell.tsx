"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { timeAgo } from "@/lib/format";
import type { NotificationDoc } from "@/lib/types";

export function NotificationBell() {
  const [items, setItems] = useState<NotificationDoc[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (r.ok) setItems((await r.json()).items ?? []);
    } catch {
      // Offline: keep the last list.
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const unread = items.filter((i) => !i.read).length;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread) {
      await fetch("/api/notifications", { method: "POST" });
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
    }
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={toggle} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} className="relative flex h-11 w-11 items-center justify-center rounded-full text-fog hover:bg-ink-3 hover:text-white">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-signal ring-2 ring-ink" />}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[14px] bg-white text-ink shadow-2xl fade-in">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <span className="lab text-[11px] text-ash">Notifications</span>
            <Link href="/app/settings" className="text-xs font-semibold text-signal-text" onClick={() => setOpen(false)}>Settings</Link>
          </div>
          <ul className="max-h-[360px] overflow-y-auto">
            {items.length === 0 && <li className="px-4 py-6 text-sm text-ash">Nothing yet. Run the arena or connect an agent and alerts land here.</li>}
            {items.map((n) => (
              <li key={n.id} className="border-b border-line-soft last:border-0">
                <Link href={n.link || "/app"} onClick={() => setOpen(false)} className="flex flex-col gap-1 px-4 py-3 text-ink no-underline hover:bg-stone">
                  <span className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{n.title}</strong>
                    <span className="lab shrink-0 text-[10px] text-ash">{timeAgo(n.createdAt)}</span>
                  </span>
                  <span className="text-[13px] leading-snug text-ash-2">{n.body}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
