import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "利用規約（草案）" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm leading-7">
      <Link href="/" className="text-xs text-muted underline">← トップへ</Link>
      <h1 className="mt-3 text-xl font-bold">利用規約（草案）</h1>
      <p className="mt-2 rounded border border-amber-200 bg-ad-soft px-3 py-2 text-xs text-amber-900">開発中の草案です。公開前に専門家の確認を受けて確定します。</p>
      <ul className="mt-6 list-disc space-y-2 pl-5">
        <li>なまらAIが表示する店舗情報（価格・営業時間など）は、確認日時点の情報です。最新の情報は店舗にご確認ください。空席状況は確認していません。</li>
        <li>検索結果のうち「広告」「スポンサー」と表示された枠は、掲載料を受け取って表示しています。通常のおすすめ順位は掲載料で変わりません。</li>
        <li>検索データの取り扱いはプライバシーポリシーに定めます。</li>
        <li>NAMARA REVIEW への加入は、なまらグルメのメディア（Instagram等）へのPR掲載を保証するものではありません。PR掲載は別途契約です。</li>
      </ul>
    </main>
  );
}
