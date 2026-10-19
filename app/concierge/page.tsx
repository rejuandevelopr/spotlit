import type { Metadata } from "next";
import { PublicHeader } from "@/components/spotlit/PublicHeader";
import { ConciergeChat } from "@/components/views/ConciergeChat";

export const metadata: Metadata = { title: "Concierge" };

export default async function ConciergePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="flex min-h-screen flex-col bg-ink text-white">
      <PublicHeader />
      <ConciergeChat initial={q ?? ""} />
    </div>
  );
}
