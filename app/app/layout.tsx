import { pageUser } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await pageUser("/app");
  return <div className="min-h-screen bg-stone text-ink">{children}</div>;
}
