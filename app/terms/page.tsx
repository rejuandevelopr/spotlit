import type { Metadata } from "next";
import { PublicHeader } from "@/components/spotlit/PublicHeader";

export const metadata: Metadata = { title: "Terms" };

export default function Terms() {
  return (
    <div className="min-h-screen bg-stone text-ink">
      <PublicHeader />
      <main className="mx-auto flex max-w-[760px] flex-col gap-5 px-4 pb-24 pt-12 text-[15px] leading-relaxed text-ash-2 sm:px-8">
        <h1 className="serif m-0 text-6xl leading-none text-ink">Terms</h1>
        <p>Spotlit is provided as is, for the Qloo Agentic Hackathon 2026. Agent Arena results are simulations, not predictions or guarantees.</p>
        <p>Only claim a venue you are authorized to represent. Claims are first come, first served during the beta, and we may remove claims that look wrong.</p>
        <p>Venue agents recommend and share booking links. They never book on anyone&apos;s behalf.</p>
      </main>
    </div>
  );
}
