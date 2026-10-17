import Link from "next/link";
import { Logo } from "../ui/Logo";

export function UserHeader({ loggedIn, storeLink, adminLink }: { loggedIn: boolean; storeLink?: boolean; adminLink?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
        <Link href="/" aria-label="TABETUNAGU ホーム">
          <Logo />
        </Link>
        <div className="flex items-center gap-1.5 text-[12px] font-semibold">
          {storeLink && (
            <Link href="/store" className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-canvas">
              店舗管理
            </Link>
          )}
          {adminLink && (
            <Link href="/admin" className="rounded-full px-3 py-1.5 text-ink-2 hover:bg-canvas">
              管理
            </Link>
          )}
          {!loggedIn && (
            <Link href="/login" className="rounded-full border border-line px-3.5 py-1.5 text-ink hover:bg-canvas">
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
