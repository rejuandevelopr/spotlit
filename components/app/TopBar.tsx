"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/spotlit/Brand";
import { initials } from "@/lib/format";
import { NotificationBell } from "./NotificationBell";

export function TopBar({ user }: { user: { name: string; photoURL: string | null } }) {
  const path = usePathname();
  const item = (href: string, label: string, active: boolean) => (
    <Link key={href} href={href} className="top-item" aria-current={active ? "page" : undefined}>
      {label}
    </Link>
  );
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
        <div className="flex flex-wrap items-center gap-6">
          <Wordmark width={104} href="/app" />
          <nav aria-label="Account" className="flex flex-wrap gap-1">
            {item("/app", "My venues", path === "/app" || path.startsWith("/app/new"))}
            {item("/concierge", "Concierge", false)}
            {item("/docs", "Docs", false)}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link href="/app/settings" aria-label={`Account settings for ${user.name}`} className="flex min-h-11 items-center gap-2.5 text-white no-underline">
            <span className="hidden text-sm text-fog sm:inline">{user.name}</span>
            <Avatar name={user.name} photoURL={user.photoURL} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Avatar({ name, photoURL, size = 38 }: { name: string; photoURL: string | null; size?: number }) {
  if (photoURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoURL} alt="" width={size} height={size} referrerPolicy="no-referrer" className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="flex items-center justify-center rounded-full bg-signal text-sm font-semibold text-signal-ink" style={{ width: size, height: size }}>
      {initials(name)}
    </span>
  );
}
