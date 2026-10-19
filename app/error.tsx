"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-ink px-6 text-center text-white">
      <h1 className="serif m-0 text-5xl leading-none">Something went wrong.</h1>
      <p className="m-0 max-w-[520px] text-mist">{error.message || "An unexpected error happened."}</p>
      <button type="button" onClick={reset} className="btn btn-signal">Try again</button>
    </div>
  );
}
