import { CircleCheck, CircleDashed, PartyPopper } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { features } from "@/lib/features";
import { PICKUP_FLOW } from "@/lib/onboarding";
import { requireStoreMember } from "@/server/auth/viewer";
import { logEvent } from "@/server/services/events";
import { getStoreOnboarding } from "@/server/services/onboarding";

export const metadata: Metadata = { title: "TABETUNAGU を始める準備" };

/**
 * 店舗のオンボーディング（v2）。5つのステップの進捗は店舗の実際の状態から毎回計算する（途中で閉じても続きから再開できる）。
 * 長い説明は置かず、各ステップで「次にやること」を1つだけ示す。
 */
export default async function StoreStartPage() {
  if (!features.v2Journey) notFound();
  const { viewer, store } = await requireStoreMember("/store/start");
  const owner = store.role === "owner";
  const { steps, progress } = await getStoreOnboarding(viewer.id, store.storeId, owner);
  await logEvent("store_onboarding_viewed", { userId: viewer.id, storeId: store.storeId, properties: { done: progress.done, total: progress.total } });

  return (
    <div className="max-w-2xl space-y-6" data-testid="store-onboarding" data-done={progress.done}>
      <div>
        <h1 className="text-[22px] font-bold">TABETUNAGU を始める準備</h1>
        <p className="mt-1 text-[13px] text-ink-2">商品を公開して、売れたら店舗モニターを見て渡すだけ。そのための準備です。</p>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-semibold" aria-label="TABETUNAGU の特徴">
          {["導入費ゼロ（まずは FREE で始められます）", "お支払いはオンライン事前決済", "受取時の店舗操作は原則ありません"].map((t) => (
            <li key={t} className="rounded-full bg-leaf-soft px-3 py-1 text-forest-2">
              {t}
            </li>
          ))}
        </ul>
      </div>

      {progress.complete ? (
        <section className="card border-2 border-forest p-5 text-center" data-testid="onboarding-complete">
          <PartyPopper className="mx-auto h-10 w-10 text-forest" aria-hidden />
          <h2 className="mt-2 text-[20px] font-bold">TABETUNAGU を始める準備ができました！</h2>
          <p className="mt-1 text-[14px] font-semibold text-forest-2">余ったら出品。売れたら渡すだけ。</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <ButtonLink href="/store/products/new" size="lg">
              商品を出品する
            </ButtonLink>
            <ButtonLink href="/store" variant="secondary" size="lg">
              店舗ダッシュボードへ
            </ButtonLink>
          </div>
        </section>
      ) : (
        <section className="card p-5" data-testid="onboarding-progress" aria-labelledby="progress-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="progress-title" className="text-[15px] font-bold">
              準備の進み具合
            </h2>
            <span className="tnum text-[18px] font-bold" data-testid="onboarding-progress-label">
              {progress.label}
            </span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-canvas"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label={`準備 ${progress.label}`}
          >
            <div className="h-full rounded-full bg-forest" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          {progress.next && (
            <p className="mt-3 text-[13.5px]" data-testid="onboarding-next">
              次にやること：<span className="font-bold">{progress.next.title}</span>
            </p>
          )}
        </section>
      )}

      <ol className="space-y-3" aria-label="準備のステップ">
        {steps.map((s) => {
          const current = progress.next?.key === s.key;
          return (
            <li
              key={s.key}
              className={cn("card p-4", current && "border-2 border-forest")}
              data-testid={`onboarding-step-${s.key}`}
              data-done={s.done ? "yes" : "no"}
              aria-current={current ? "step" : undefined}
            >
              <div className="flex items-start gap-3">
                {s.done ? (
                  <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-forest" aria-hidden />
                ) : (
                  <CircleDashed className="mt-0.5 h-6 w-6 shrink-0 text-muted" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[15px] font-bold">
                    <span className="tnum text-muted">{s.no}.</span>
                    {s.title}
                    <span className={cn("rounded-full px-2 py-0.5 text-[11.5px]", s.done ? "bg-leaf-soft text-forest-2" : "bg-canvas text-ink-2")}>
                      {s.done ? "完了" : "未完了"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-2" data-testid="onboarding-step-status">
                    {s.status}
                  </p>
                  {s.key === "monitor" && !s.done && (
                    <ol className="mt-2 space-y-1 rounded-xl bg-canvas px-3 py-2.5 text-[12.5px]" aria-label="受取の流れ">
                      {PICKUP_FLOW.map((f, i) => (
                        <li key={f.title}>
                          <span className="tnum font-bold">{i + 1}.</span> <span className="font-semibold">{f.title}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {s.cta && (
                    <ButtonLink href={s.cta.href} size="md" variant={current ? "primary" : "secondary"} className="mt-3" data-testid="onboarding-step-cta">
                      {s.cta.label}
                    </ButtonLink>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <section className="card p-5 text-[13px]" aria-labelledby="key-points-title">
        <h2 id="key-points-title" className="text-[15px] font-bold">
          受取のときに知っておくこと
        </h2>
        <ul className="mt-2 space-y-1">
          <li>・レジ操作・店頭でのお会計はありません（お支払いはオンラインで完了しています）。</li>
          <li>・受取完了はお客様が操作します。お店はチケットを確認して商品をお渡しするだけです。</li>
        </ul>
        <Link href="/store/help" className="mt-3 inline-block font-semibold text-forest underline">
          使い方・よくある質問
        </Link>
      </section>
    </div>
  );
}
