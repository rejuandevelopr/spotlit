import Link from "next/link";
import { Wordmark } from "./Brand";
import { getSessionUser } from "@/lib/auth";

export async function PublicHeader() {
  const user = await getSessionUser().catch(() => null);
  return (
    <header className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Wordmark width={112} />
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <Link href="/concierge" className="top-item">Concierge</Link>
          <Link href="/demo" className="top-item">Demo</Link>
          <Link href="/docs" className="top-item">Docs</Link>
          {user ? (
            <Link href="/app" className="btn btn-sm btn-white ml-2">My venues</Link>
          ) : (
            <Link href="/signin" className="btn btn-sm btn-line-dark ml-2">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
