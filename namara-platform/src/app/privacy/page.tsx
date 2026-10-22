import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "プライバシーポリシー（草案）" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm leading-7">
      <Link href="/" className="text-xs text-muted underline">← トップへ</Link>
      <h1 className="mt-3 text-xl font-bold">プライバシーポリシー（草案）</h1>
      <p className="mt-2 rounded border border-amber-200 bg-ad-soft px-3 py-2 text-xs text-amber-900">
        開発中の草案です。公開前に専門家の確認を受けて確定します。
      </p>
      <h2 className="mt-6 font-bold">1. 取得する情報</h2>
      <ul className="list-disc pl-5">
        <li>なまらAIへの検索内容（入力文と、そこから読み取ったエリア・ジャンル・予算などの条件）</li>
        <li>検索結果の表示・クリック・保存などの操作履歴</li>
        <li>LINEでご利用の場合は、LINEから通知される利用者識別子（当社では暗号学的に変換した値のみ保存します）</li>
      </ul>
      <h2 className="mt-6 font-bold">2. 利用目的</h2>
      <ul className="list-disc pl-5">
        <li>お店の検索・推薦の提供と品質改善</li>
        <li>不正利用の防止</li>
        <li>個人を特定できない形に集計した統計情報を、飲食店向けサービス（NAMARA REVIEW）で提供すること</li>
      </ul>
      <h2 className="mt-6 font-bold">3. 飲食店への提供について</h2>
      <p>飲食店に提供するのは、一定人数以上の利用者をまとめた匿名の集計値のみです。入力文そのもの、利用者の識別子、個人の操作履歴は提供しません。</p>
      <h2 className="mt-6 font-bold">4. 保存期間</h2>
      <p>入力文は90日後に削除し、集計に必要な条件のみを保持します。操作履歴の保存期間は最長13か月を予定しています。</p>
      <h2 className="mt-6 font-bold">5. 削除のご依頼</h2>
      <p>ご自身の検索履歴の削除をご希望の場合は、LINEのメニューまたはお問い合わせ窓口からご連絡ください（窓口は公開時に記載します）。</p>
    </main>
  );
}
