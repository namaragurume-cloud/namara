import Link from "next/link";

export const LEGAL_LINKS = [
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/commerce", label: "特定商取引法に基づく表記" },
  { href: "/cancellation-policy", label: "キャンセルポリシー" },
] as const;

/** ユーザー画面の下部（LINE ミニアプリ内からもたどれるよう、ページ内に置く） */
export function LegalLinks() {
  return (
    <nav aria-label="規約・ポリシー" className="mt-10 border-t border-line pt-4 text-[11.5px] text-muted" data-testid="legal-links">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LEGAL_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="underline-offset-2 hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
