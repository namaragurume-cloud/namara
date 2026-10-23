import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { features } from "@/lib/features";
import { PICKUP_FLOW } from "@/lib/onboarding";
import { ORDER_POLICY } from "@/lib/orders";
import { requireStoreMember } from "@/server/auth/viewer";

export const metadata: Metadata = { title: "TABETUNAGU の使い方" };

/**
 * 店舗向けの使い方・よくある質問（PoC）。受取の流れは受取チケット・店舗モニターの実装と同じ順番（lib/onboarding の PICKUP_FLOW）。
 * スタッフには受取・モニター中心の内容だけを出し、売上受取設定・プランなどのオーナー向けの内容は出さない。
 */
export default async function StoreHelpPage() {
  const { store } = await requireStoreMember("/store/help");
  const owner = store.role === "owner";
  const v2 = features.v2Journey;
  const grace = ORDER_POLICY.pickupLateGraceMinutes;

  const faq: { q: string; a: React.ReactNode }[] = [
    { q: "店頭でお金を受け取りますか？", a: "いいえ。お支払いはお客様がオンラインで済ませています。レジ操作・店頭でのお会計はありません。" },
    { q: "受取完了は店舗が押しますか？", a: "いいえ。商品を受け取ったお客様が、ご自身の画面でスワイプして受取完了にします。店舗モニターに自動で表示されます。" },
    {
      q: "お客様が来なかったら？",
      a: `受取終了から${grace}分を過ぎても受取完了にならなかった注文は「未受取」になります。返金の扱いは`,
    },
    { q: "通知音が鳴りません。", a: "受取モニターの「通知音をON」を押してください。端末の音量・マナーモードもご確認ください。" },
    {
      q: "通信が切れたら？",
      a: "受取モニターは最後に表示した内容をそのまま残し、通信が戻ると自動で最新の状態に更新します。「更新できません」と出たときは、端末の通信をご確認ください。",
    },
    ...(owner
      ? [
          { q: "間違って商品を出品しました。", a: "「出品商品」から受付を停止できます。すでに売れた注文は「注文（事前決済）」の各注文の「その他の操作」から店舗都合のキャンセルができます。" },
          { q: "料金はかかりますか？", a: "導入費はかかりません。まずは FREE プラン（月額0円・売れた分の成約手数料のみ）で始められます。" },
        ]
      : []),
  ];

  return (
    <div className="max-w-2xl space-y-6" data-testid="store-help" data-role={store.role}>
      <PageHeader title="TABETUNAGU の使い方" />

      <section className="card border-2 border-forest p-5" data-testid="help-hero">
        <p className="text-[22px] font-bold text-forest-2">売れたら、渡すだけ。</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
          決済はオンラインで完了しています。
          <br />
          店舗でのお会計や受取完了操作はありません。
        </p>
      </section>

      <section aria-labelledby="flow-title">
        <h2 id="flow-title" className="mb-3 text-[16px] font-bold">
          受取の流れ
        </h2>
        <ol className="space-y-2.5" data-testid="help-flow">
          {PICKUP_FLOW.map((s, i) => (
            <li key={s.title} className="card flex gap-4 p-4">
              <span className="tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest text-[15px] font-bold text-white" aria-hidden>
                {i + 1}
              </span>
              <div>
                <p className="text-[15px] font-bold">
                  <span className="sr-only">{i + 1}. </span>
                  {s.title}
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="card space-y-2 p-5 text-[13px] leading-relaxed">
        <h2 className="text-[15px] font-bold">店頭タブレットの準備</h2>
        <p>
          <Link href="/store/monitor" className="font-semibold text-forest underline">
            受取モニター
          </Link>
          を開き、「全画面モード」と「通知音をON」を押してください。対応している端末では画面のスリープも止まります。
          止まらない端末では、端末の設定で自動ロック（スリープ）をオフにしてください。
        </p>
      </section>

      {owner && (
        <section className="card p-5" aria-labelledby="owner-title" data-testid="help-owner">
          <h2 id="owner-title" className="text-[15px] font-bold">
            オーナー向け
          </h2>
          <ul className="mt-2 divide-y divide-line text-[13.5px]">
            {[
              { href: "/store/start", label: "TABETUNAGU を始める準備（進み具合）" },
              { href: "/store/products/new", label: "商品を登録・公開する" },
              { href: "/store/sales", label: "売上・手数料を確認する" },
              { href: "/store/payouts", label: "売上受取設定" },
              { href: "/store/settings#plan", label: "料金プラン（まずは FREE で始められます）" },
              { href: "/store/settings#store-info", label: "店舗情報・受取場所の案内" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="flex min-h-[44px] items-center justify-between gap-2 text-forest">
                  {l.label}
                  <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="faq-title" data-testid="help-faq">
        <h2 id="faq-title" className="mb-3 text-[16px] font-bold">
          よくある質問
        </h2>
        <div className="card divide-y divide-line">
          {faq.map((f) => (
            <details key={f.q} className="group px-4 py-3">
              <summary className="cursor-pointer text-[14px] font-semibold">Q. {f.q}</summary>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                A. {f.a}
                {f.q === "お客様が来なかったら？" && (
                  <>
                    <Link href="/cancellation-policy" className="mx-0.5 font-semibold text-forest underline">
                      キャンセルポリシー
                    </Link>
                    をご確認ください。
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </section>

      <section className="card p-5 text-[13px]" aria-labelledby="trouble-title" data-testid="help-trouble">
        <h2 id="trouble-title" className="text-[15px] font-bold">
          困ったとき
        </h2>
        <ul className="mt-2 divide-y divide-line">
          {[
            { href: "/store/products", label: "商品を公開停止したい", body: "「出品商品」の「受付停止」" },
            { href: "/store/orders", label: "注文をキャンセルしたい", body: "各注文の「その他の操作」から店舗都合のキャンセル" },
            { href: "/store/monitor", label: "店舗モニターが更新されない", body: "通信を確認し、画面を再読み込み" },
            ...(owner ? [{ href: "/store/payouts", label: "売上受取設定を確認したい", body: "設定の状態と続きの入力" }] : []),
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-[48px] items-center justify-between gap-2 py-2">
                <span>
                  <span className="block font-semibold text-forest">{l.label}</span>
                  <span className="block text-[12px] text-ink-2">{l.body}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12.5px] text-ink-2">お客様のチケットに「支払い済み」が表示されていない場合は、商品を渡さず運営へご連絡ください。</p>
      </section>

      {owner && v2 && (
        <details className="card p-5 text-[13px] leading-relaxed" data-testid="help-emergency">
          <summary className="cursor-pointer text-[14px] font-bold">緊急時の受取対応（オーナー向け）</summary>
          <p className="mt-2">
            システム障害で事前決済が使えない場合に限り、運営の判断で以前の「店頭 QR」の方式に一時的に切り替えることがあります（自動では切り替わりません）。
            その場合は運営からご連絡します。通常の受取では使いません。
          </p>
          <Link href="/store/qr" className="mt-2 inline-block font-semibold text-forest underline">
            店頭QRコード（障害時用）
          </Link>
        </details>
      )}
    </div>
  );
}
