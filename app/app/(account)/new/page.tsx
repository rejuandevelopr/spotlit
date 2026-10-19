import type { Metadata } from "next";
import { StepPills } from "@/components/app/StepPills";
import { FindVenue } from "@/components/app/FindVenue";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Find your venue" };

export default function NewVenuePage() {
  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-10 px-4 pb-24 pt-12 sm:px-8">
      <div className="flex max-w-[760px] flex-col gap-3.5">
        <StepPills current={1} />
        <span className="lab text-signal-text">Step 01</span>
        <h1 className="serif m-0 text-[clamp(48px,6vw,80px)] leading-[0.98]">Find your venue.</h1>
        <p className="m-0 text-[17px] leading-relaxed text-ash-2">
          We look you up in Qloo&apos;s graph of places. If you&apos;re too new or too small to be listed, describe it and we&apos;ll map it to taste tags.
        </p>
      </div>
      <FindVenue defaultCity={env.demoCity} />
    </main>
  );
}
