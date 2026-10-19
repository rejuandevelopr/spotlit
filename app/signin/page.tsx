import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { OMark } from "@/components/spotlit/Brand";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getSessionUser()) redirect(next && next.startsWith("/app") ? next : "/app");
  return (
    <AuthShell
      image="/brand/halftone-city-heatmap-1920x1080.png"
      panel={
        <>
          <h2 className="serif m-0 text-[clamp(44px,5vw,64px)] leading-none">
            Agents asked about you <em className="text-signal">while you were away</em>.
          </h2>
          <div className="flex items-center gap-3.5 rounded-[14px] border border-white/10 bg-white/5 p-4">
            <OMark size={28} />
            <span className="text-sm leading-normal text-fog">Sign in to see every request that reached your venue&apos;s agent, and the ones you lost.</span>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <h1 className="serif m-0 text-[52px] leading-none">Welcome back</h1>
        <p className="m-0 text-base leading-relaxed text-ash-2">Sign in with the Google account you used to create Spotlit.</p>
      </div>
      <GoogleButton next={next} />
      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="m-0 text-sm text-ash-2">
          New to Spotlit? <Link href="/signup" className="font-semibold text-signal-text">Create an account</Link>
        </p>
        <div className="flex flex-col gap-1 rounded-xl border border-dashed border-[#A9A79F] px-4 py-3.5">
          <span className="lab text-[10px] text-ash">For hackathon judges</span>
          <span className="text-[13px] leading-normal text-ash-2">
            Sign in with any Google account to get your own workspace, or <Link href="/demo" className="text-signal-text">open the demo venue</Link> without signing in.
          </span>
        </div>
      </div>
    </AuthShell>
  );
}
