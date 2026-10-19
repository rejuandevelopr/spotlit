import type { Metadata } from "next";
import { PublicHeader } from "@/components/spotlit/PublicHeader";

export const metadata: Metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <div className="min-h-screen bg-stone text-ink">
      <PublicHeader />
      <main className="mx-auto flex max-w-[760px] flex-col gap-5 px-4 pb-24 pt-12 text-[15px] leading-relaxed text-ash-2 sm:px-8">
        <h1 className="serif m-0 text-6xl leading-none text-ink">Privacy</h1>
        <p>Spotlit is a hackathon project. When you sign in with Google we store your name, email and photo to run your account. We never sell data and never send email.</p>
        <p>Venue data comes from the Qloo API and from facts owners add to their agent card. Requests that outside agents send to a venue agent are stored in that venue&apos;s inbox so the owner can see them.</p>
        <p>Delete your account any time in Settings. That removes your profile and notifications and releases your venues.</p>
      </main>
    </div>
  );
}
