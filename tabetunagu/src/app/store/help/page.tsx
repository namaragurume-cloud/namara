import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Notice } from "@/components/ui/Section";
import { requireStoreMember } from "@/server/auth/viewer";

export const metadata: Metadata = { title: "TABETUNAGU の使い方" };

const STEPS = [
  { title: "商品を出品する", body: "「出品する」から商品・数量・価格・受取時間を登録します。いつもの内容はワンタップで出品できます。" },
  { title: "売れたら受取モニターで確認", body: "お客様はオンラインで先にお支払いを済ませています。「受取モニター」に今日の注文が表示されます。" },
  { title: "お客様が来店", body: "受取時間内にお客様がお店に来られます。" },
  { title: "受取チケットを確認", body: "お客様のスマホの「受取チケット」（支払い済み・注文番号・商品）を確認します。" },
  { title: "お客様がスワイプ", body: "お客様ご自身が画面の「→ スワイプして受取完了」を操作します。" },
  { title: "チリン♪が鳴ったら商品を渡す", body: "受取モニターに「受取完了」が表示され、通知音が鳴ります。商品をお渡しください。" },
];

/** 店舗向けの使い方（PoC） */
export default async function StoreHelpPage() {
  await requireStoreMember("/store/help");
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="TABETUNAGU の使い方" />
      <Notice tone="success">
        <strong>レジ操作は不要です。</strong>お支払いはお客様がオンラインで済ませています。
        <br />
        <strong>店舗側の受取完了操作は不要です。</strong>受取完了はお客様のスワイプで自動的に記録されます。
      </Notice>
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card flex gap-4 p-4">
            <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-[15px] font-bold text-white">
              {i + 1}
            </span>
            <div>
              <p className="text-[15px] font-bold">{s.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="card space-y-2 p-5 text-[13px] leading-relaxed">
        <h2 className="text-[15px] font-bold">店頭タブレットの準備</h2>
        <p>
          <Link href="/store/monitor" className="font-semibold text-forest underline">受取モニター</Link>
          を開き、「全画面モード」と「受取通知音をON」を押してください。対応している端末では画面のスリープも止まります。
          止まらない端末では、端末の設定で自動ロック（スリープ）をオフにしてください。
        </p>
      </section>
      <section className="card space-y-2 p-5 text-[13px] leading-relaxed">
        <h2 className="text-[15px] font-bold">困ったとき</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>お客様のチケットに「支払い済み」が表示されていない場合は、商品を渡さず運営へご連絡ください。</li>
          <li>店舗の都合で商品をお渡しできない場合は、「注文（事前決済）」の各注文の「その他の操作」から店舗都合のキャンセル・返金ができます。</li>
          <li>
            システム障害で事前決済が使えない場合、運営の判断で以前の「予約 → 店頭 QR」の方式に一時的に切り替えることがあります（自動では切り替わりません）。
            その場合は運営からご連絡します。
          </li>
        </ul>
      </section>
    </div>
  );
}
