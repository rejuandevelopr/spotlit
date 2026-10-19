"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleIcon } from "@/components/spotlit/Brand";
import { SignOutButton } from "@/components/auth/GoogleButton";
import { Avatar } from "./TopBar";

type Prefs = { lostRequests: boolean; weeklyReport: boolean; runFinished: boolean };

const NOTES: { key: keyof Prefs; title: string; desc: string }[] = [
  { key: "lostRequests", title: "Lost or unanswered agent requests", desc: "When an outside agent asks and your venue could not answer or did not fit" },
  { key: "runFinished", title: "Arena run finished", desc: "When a simulation completes, with your Share of Agent Voice" },
  { key: "weeklyReport", title: "Weekly summary", desc: "Asks, wins and the next best fix, every Monday" },
];

export function SettingsForm({ user, mock }: { user: { name: string; email: string; photoURL: string | null; role: string; prefs: Prefs }; mock: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState(user.role);
  const [prefs, setPrefs] = useState<Prefs>(user.prefs);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function patch(body: Record<string, unknown>, msg: string) {
    const r = await fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setSaved(r.ok ? msg : "Could not save");
    setTimeout(() => setSaved(null), 2000);
    router.refresh();
  }

  async function toggle(k: keyof Prefs) {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    await patch({ notificationPrefs: next }, "Notifications updated");
  }

  async function del() {
    const r = await fetch("/api/me", { method: "DELETE" });
    if (r.ok) {
      const { firebaseSignOut } = await import("@/lib/firebase/client");
      await firebaseSignOut();
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-8">
      <nav aria-label="Settings sections" className="flex flex-[1_1_200px] flex-col gap-0.5 md:sticky md:top-6">
        {[
          ["#profile", "Profile"],
          ["#security", "Sign in and security"],
          ["#notifications", "Notifications"],
          ["#danger", "Delete account"],
        ].map(([href, label], i) => (
          <a key={href} href={href} className={`flex min-h-11 items-center rounded-[10px] px-3.5 text-sm no-underline ${i === 0 ? "bg-ink font-semibold text-white" : "text-ink hover:bg-white"}`}>
            {label}
          </a>
        ))}
      </nav>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        {saved && <div role="status" className="lab self-start rounded-md bg-ink px-3 py-2 text-[11px] text-white">{saved}</div>}
        <section id="profile" className="card">
          <span className="lab text-ash">Profile</span>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={name} photoURL={user.photoURL} size={72} />
            <span className="text-[13px] text-ash">Photo from your Google account</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Full name
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              Role
              <select className="field" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="owner">Owner</option>
                <option value="manager">Manager</option>
                <option value="marketing">Marketing</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span className="flex justify-between">
              Email<span className="lab text-[10px] text-ash">From Google</span>
            </span>
            <input className="field bg-[#F6F5F1] text-ash-2" value={user.email} readOnly />
          </label>
          <div className="flex justify-end">
            <button type="button" className="btn btn-sm btn-ink" onClick={() => patch({ name, role }, "Profile saved")}>
              Save changes
            </button>
          </div>
        </section>

        <section id="security" className="card">
          <span className="lab text-ash">Sign in and security</span>
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-stone p-4">
            <div className="flex items-center gap-3.5">
              <span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white">
                <GoogleIcon size={18} />
              </span>
              <div className="flex flex-col gap-0.5">
                <strong className="text-[15px]">Signed in with Google{mock ? " (mock mode)" : ""}</strong>
                <span className="text-[13px] text-ash">{user.email} · Password and two step security are managed by Google</span>
              </div>
            </div>
            <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer" className="btn btn-sm btn-line">
              Manage Google account
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line-soft px-4 py-3.5">
            <span className="flex-1 text-sm">
              <strong>This browser</strong> · Session cookie, expires after 14 days
            </span>
            <SignOutButton />
          </div>
        </section>

        <section id="notifications" className="card">
          <span className="lab text-ash">Notifications</span>
          <p className="m-0 text-[13px] text-ash">In app alerts in the bell at the top. Spotlit never sends email.</p>
          <div className="flex flex-col">
            {NOTES.map((n) => (
              <div key={n.key} className="flex items-center justify-between gap-4 border-t border-line-soft py-3.5">
                <div className="flex flex-col gap-0.5">
                  <strong className="text-[15px]">Notify me: {n.title.toLowerCase()}</strong>
                  <span className="text-[13px] text-ash">{n.desc}</span>
                </div>
                <button type="button" role="switch" aria-checked={prefs[n.key]} aria-label={n.title} onClick={() => toggle(n.key)} className="flex h-11 w-[52px] shrink-0 items-center justify-center">
                  <span className={`relative block h-[26px] w-11 rounded-full transition-colors ${prefs[n.key] ? "bg-signal" : "bg-line"}`}>
                    <span className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all" style={{ left: prefs[n.key] ? 21 : 3 }} />
                  </span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <section id="danger" className="card border border-signal-soft">
          <span className="lab text-[#A33E1E]">Delete account</span>
          <p className="m-0 text-sm leading-relaxed text-ash-2">
            Deletes your account, releases your claimed venues and takes their agents back to public data only. This can&apos;t be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            {confirm ? (
              <>
                <button type="button" onClick={del} className="btn btn-sm bg-[#A33E1E] text-white">Yes, delete everything</button>
                <button type="button" onClick={() => setConfirm(false)} className="btn btn-sm btn-line">Cancel</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="btn btn-sm border border-[#A33E1E] bg-white text-[#A33E1E]">
                Delete my account
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
