import Link from "next/link";
import { Wordmark } from "@/components/spotlit/Brand";

export function DemoPending({ status, error, mock }: { status: string | null; error?: string; mock: boolean }) {
  const seeding = status === "seeding" || (mock && status !== "failed");
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink px-6 text-center text-white">
      {seeding && <meta httpEquiv="refresh" content="4" />}
      <Wordmark width={140} />
      <h1 className="serif m-0 max-w-[640px] text-5xl leading-none">
        {seeding ? "Setting up the demo venue…" : "The demo venue is not ready yet."}
      </h1>
      <p className="m-0 max-w-[560px] text-mist">
        {seeding
          ? "Spotlit is building Halftone House, running a 60 persona baseline arena, applying the strategist's fixes and re-running the same personas. This page refreshes on its own."
          : error
            ? `Seeding failed: ${error}`
            : "Run npm run seed:demo once to build Halftone House, its baseline run and the measured what if run."}
      </p>
      <Link href="/" className="btn btn-line-dark">Back to Spotlit</Link>
    </div>
  );
}
