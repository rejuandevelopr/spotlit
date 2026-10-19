import { TopBar } from "@/components/app/TopBar";
import { pageUser } from "@/lib/guard";
import { getUserDoc } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser("/app");
  const doc = await getUserDoc(user.uid);
  return (
    <>
      <TopBar user={{ name: doc?.name ?? user.name, photoURL: doc?.photoURL ?? user.photoURL }} />
      {children}
    </>
  );
}
