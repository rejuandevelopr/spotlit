import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/halftone-city-heatmap-1920x1080.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="relative mx-auto flex max-w-[1280px] flex-col gap-16 px-4 pb-10 pt-24 sm:px-8 sm:pt-[120px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="serif m-0 max-w-[640px] text-[clamp(36px,4vw,56px)] leading-[1.05]">See how agents see your venue, in under five minutes.</h2>
          <Link className="btn btn-signal" href="/signup">Scan your venue</Link>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/spotlit-wordmark-on-dark-transparent.svg" alt="Spotlit" className="block w-full" />
        <div className="flex flex-wrap justify-between gap-4 text-[13px] text-smoke">
          <span>Built for the Qloo Agentic Hackathon 2026 · <Link href="/privacy" className="text-smoke underline">Privacy</Link> · <Link href="/terms" className="text-smoke underline">Terms</Link></span>
          <span className="lab text-[11px]">Taste data by Qloo · Get spotlit by agents</span>
        </div>
      </div>
    </footer>
  );
}
