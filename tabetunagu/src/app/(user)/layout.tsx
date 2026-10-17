import { BottomNav } from "@/components/layout/BottomNav";
import { UserHeader } from "@/components/layout/UserHeader";
import { getViewer } from "@/server/auth/viewer";

export default async function UserLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  return (
    <div className="min-h-dvh bg-paper">
      <UserHeader loggedIn={Boolean(viewer)} storeLink={Boolean(viewer?.memberships.length)} adminLink={viewer?.isAdmin} />
      <main className="mx-auto max-w-xl px-4 pb-[calc(88px+env(safe-area-inset-bottom))] pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
