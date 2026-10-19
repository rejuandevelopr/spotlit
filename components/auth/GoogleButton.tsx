"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleIcon } from "@/components/spotlit/Brand";
import { firebaseClientConfigured, googleIdToken } from "@/lib/firebase/client";

const MOCK = process.env.NEXT_PUBLIC_SPOTLIT_MOCK === "1" || process.env.NEXT_PUBLIC_SPOTLIT_MOCK === "true";

export function GoogleButton({ next }: { next?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      let body: Record<string, unknown>;
      if (MOCK) body = { mock: true };
      else {
        if (!firebaseClientConfigured()) throw new Error("Firebase is not configured. Add the NEXT_PUBLIC_FIREBASE_* variables.");
        body = { idToken: await googleIdToken() };
      }
      const res = await fetch("/api/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Sign in failed");
      router.push(next && next.startsWith("/app") ? next : j.redirect);
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message || "Sign in failed";
      setError(/popup-closed|cancelled-popup/.test(msg) ? "The Google window was closed. Try again." : msg);
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <button type="button" onClick={go} disabled={busy} className="btn btn-ink w-full gap-3.5 text-base" style={{ minHeight: 56 }}>
        <span aria-hidden="true" className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white">
          <GoogleIcon size={16} />
        </span>
        {busy ? "Signing in…" : "Continue with Google"}
      </button>
      {MOCK && <p className="lab text-center text-[10px] text-ash">Mock mode: signs you in as a local test owner</p>}
      {error && (
        <p role="alert" className="text-center text-sm text-signal-text">
          {error}
        </p>
      )}
    </div>
  );
}

export function SignOutButton({ className = "btn btn-sm btn-line" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        const { firebaseSignOut } = await import("@/lib/firebase/client");
        await firebaseSignOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
