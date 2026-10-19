import type { Metadata } from "next";
import { SettingsForm } from "@/components/app/SettingsForm";
import { pageUser } from "@/lib/guard";
import { getUserDoc } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await pageUser("/app/settings");
  const doc = await getUserDoc(user.uid);
  return (
    <main className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 pb-24 pt-12 sm:px-8">
      <div className="flex flex-col gap-2.5">
        <span className="lab text-ash">Account</span>
        <h1 className="serif m-0 text-[clamp(48px,6vw,76px)] leading-none">Settings</h1>
      </div>
      <SettingsForm
        mock={env.mock}
        user={{
          name: doc?.name ?? user.name,
          email: doc?.email ?? user.email,
          photoURL: doc?.photoURL ?? user.photoURL,
          role: doc?.role ?? "owner",
          prefs: doc?.notificationPrefs ?? { lostRequests: true, weeklyReport: true, runFinished: true },
        }}
      />
    </main>
  );
}
