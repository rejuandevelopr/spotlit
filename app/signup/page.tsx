import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/AuthShell";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { ArrowRight } from "@/components/spotlit/Brand";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  if (await getSessionUser()) redirect("/app");
  return (
    <AuthShell
      image="/brand/halftone-spotlight-hero-1920x1080.webp"
      panel={
        <>
          <h2 className="serif m-0 text-[clamp(44px,5vw,64px)] leading-none">
            Get <em className="text-signal">spotlit</em> by agents.
          </h2>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[15px] text-stone">
            {["See your Taste DNA from Qloo", "Test your agent against real rivals", "Fix what agents miss, and measure it"].map((t, i) => (
              <li key={t} className="flex items-center gap-3">
                <span className="lab rounded-full border border-signal px-2 py-0.5 text-[10px] text-signal">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ul>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        <span className="lab text-signal-text">Free during beta</span>
        <h1 className="serif m-0 text-[52px] leading-none">Create your account</h1>
        <p className="m-0 text-base leading-relaxed text-ash-2">One click with Google. No password to remember, no email to verify.</p>
      </div>
      <GoogleButton />
      <p className="m-0 text-[13px] leading-relaxed text-ash">
        We only use your name, email and photo from Google. By continuing you agree to the <Link href="/terms" className="text-signal-text">Terms</Link> and{" "}
        <Link href="/privacy" className="text-signal-text">Privacy Policy</Link>.
      </p>
      <div className="flex flex-col gap-3 border-t border-line pt-6">
        <p className="m-0 text-sm text-ash-2">
          Already have an account? <Link href="/signin" className="font-semibold text-signal-text">Sign in</Link>
        </p>
        <Link href="/demo" className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-dashed border-[#A9A79F] px-4 text-ink no-underline hover:border-ink">
          <span className="flex flex-col gap-0.5">
            <strong className="text-sm">Just looking?</strong>
            <span className="text-[13px] text-ash">Explore the demo venue, no account needed</span>
          </span>
          <ArrowRight />
        </Link>
      </div>
    </AuthShell>
  );
}
