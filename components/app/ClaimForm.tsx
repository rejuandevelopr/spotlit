"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "@/components/spotlit/Brand";
import { Busy, LoadingSteps } from "@/components/spotlit/Loading";

const ROLES = [
  { id: "owner", name: "Owner", desc: "I own or co own the venue" },
  { id: "manager", name: "Manager", desc: "I run it day to day" },
  { id: "marketing", name: "Marketing", desc: "I handle how it shows up online" },
] as const;

export function ClaimForm({ venueId, venueName, claimedByOther }: { venueId: string; venueName: string; claimedByOther: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<(typeof ROLES)[number]["id"]>("owner");
  const [ok, setOk] = useState(true);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taken, setTaken] = useState(claimedByOther);
  const [requested, setRequested] = useState(false);

  async function claim(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStage("Claiming…");
    try {
      const r = await fetch(`/api/venues/${venueId}/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ role, authorized: true }) });
      const j = await r.json();
      if (r.status === 409) {
        setTaken(true);
        setStage(null);
        return;
      }
      if (!r.ok) throw new Error(j.error);
      setStage("dna");
      const p = await fetch(`/api/venues/${venueId}/profile`, { method: "POST" });
      if (!p.ok) {
        const pj = await p.json().catch(() => ({}));
        // The venue is claimed; the DNA page can retry.
        console.warn(pj.error);
      }
      router.push(`/app/v/${venueId}/dna`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Could not claim");
      setStage(null);
    }
  }

  async function requestAccess() {
    await fetch(`/api/venues/${venueId}/request-access`, { method: "POST" });
    setRequested(true);
  }

  return (
    <form onSubmit={claim} className="flex min-w-0 flex-[3_1_480px] flex-col gap-6 rounded-[14px] bg-white p-6 sm:p-8">
      {taken ? (
        <div className="flex flex-col gap-4">
          <h2 className="serif m-0 text-4xl leading-none">Someone already claimed {venueName}.</h2>
          <p className="m-0 text-[15px] leading-relaxed text-ash-2">Ask the current owner for access. They get an alert in Spotlit with your name and email.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={requestAccess} disabled={requested} className="btn btn-ink">
              {requested ? "Request sent" : "Request access"}
            </button>
            <Link href="/app/new" className="btn btn-line">Find another venue</Link>
          </div>
        </div>
      ) : (
        <>
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="mb-2.5 text-[15px] font-semibold">Your role at the venue</legend>
            {ROLES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={role === r.id}
                onClick={() => setRole(r.id)}
                className={`flex min-h-16 items-center gap-3.5 rounded-xl bg-white px-4 py-3 text-left ${role === r.id ? "border-2 border-ink" : "border border-line"}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink">
                  {role === r.id && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <strong className="text-[15px] text-ink">{r.name}</strong>
                  <span className="text-[13px] text-ash">{r.desc}</span>
                </span>
              </button>
            ))}
          </fieldset>
          <label className="flex items-start gap-3 text-sm leading-relaxed text-ash-2">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] accent-ink" />
            <span>I&apos;m authorized to manage how {venueName} is represented to AI agents. Its agent will only share facts I add to its card.</span>
          </label>
          <div className="flex flex-col gap-2.5 rounded-xl bg-stone p-4">
            <span className="lab text-[10px] text-ash">After you claim</span>
            <div className="flex flex-col gap-2 text-sm">
              {["Your venue gets a live A2A agent and public page", "We build your Taste DNA and find your rivals", "You run your first arena, free"].map((t) => (
                <span key={t} className="flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-signal" />
                  {t}
                </span>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="m-0 text-sm text-signal-text">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <Link href="/app/new" className="text-sm font-semibold text-ink">Not my venue</Link>
            <button type="submit" disabled={!ok || !!stage} className="btn btn-signal" style={{ minHeight: 52 }}>
              {stage ? (
                stage === "dna" ? (
                  <LoadingSteps
                    every={6000}
                    steps={[
                      "Claiming your venue…",
                      "Reading your taste tags from Qloo…",
                      "Mapping your crowd by age and gender…",
                      "Finding artists, films and brands your crowd loves…",
                      "Drawing where your crowd is on the heatmap…",
                      "Finding taste rivals nearby…",
                      "Almost there…",
                    ]}
                  />
                ) : (
                  <Busy label={stage} />
                )
              ) : (
                <>
                  Claim and build Taste DNA <ArrowRight />
                </>
              )}
            </button>
          </div>
          <p className="m-0 border-t border-line-soft pt-4 text-[13px] text-ash">
            Someone already claimed it?{" "}
            <button type="button" onClick={() => setTaken(true)} className="font-semibold text-signal-text">
              Request access
            </button>{" "}
            and the current owner gets an in app alert.
          </p>
        </>
      )}
    </form>
  );
}
