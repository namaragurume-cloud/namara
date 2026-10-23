import type { Metadata } from "next";
import { autoRelistAction, deleteTemplateAction } from "@/app/actions/store";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { ChangePlanForm, StoreInfoForm } from "@/components/store/StoreSettingsForms";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/components/ui/cn";
import { features } from "@/lib/features";
import { BREAK_EVEN_GMV, PLANS } from "@/lib/fees";
import { yen } from "@/lib/format";
import { requireStoreMember } from "@/server/auth/viewer";
import { getStoreSettings, listTemplates, weekdayLabel } from "@/server/services/store";

export const metadata: Metadata = { title: "店舗設定・プラン" };

const FEATURES = [
  { label: "商品出品・LINE / Web 掲載・予約受付", free: true, standard: true },
  { label: "基本的な販売実績", free: true, standard: true },
  { label: "AI販売文章生成", free: "簡易", standard: true },
  { label: "AI値引き提案", free: false, standard: true },
  { label: "販売分析（時間帯別・商品別）", free: false, standard: true },
  { label: "自動再出品", free: false, standard: true },
  { label: "優先掲載", free: false, standard: true },
  { label: "お気に入りユーザーへの通知", free: false, standard: true },
];
const V2_FEATURES = FEATURES.map((f, i) => (i === 0 ? { ...f, label: "商品出品・LINE / Web 掲載・注文受付" } : f));

export default async function StoreSettingsPage() {
  const { viewer, store } = await requireStoreMember("/store/settings");
  const [settings, templates] = await Promise.all([getStoreSettings(viewer.id, store.storeId), listTemplates(viewer.id, store.storeId)]);
  const owner = store.role === "owner";
  const current = settings.store.plan;

  return (
    <div className="space-y-8">
      <PageHeader title="店舗設定・プラン" />

      <section id="plan" className="scroll-mt-24">
        <h2 className="mb-3 text-[16px] font-bold">料金プラン</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(["free", "standard"] as const).map((code) => {
            const p = PLANS[code];
            return (
              <div key={code} className={cn("card p-5", current === code && "border-forest ring-1 ring-forest")}>
                <div className="flex items-center justify-between">
                  <p className="font-en text-[15px] font-semibold tracking-[0.15em]">{p.name}</p>
                  {current === code && <Badge tone="green">ご利用中</Badge>}
                </div>
                <p className="tnum mt-3 text-[26px] font-semibold">
                  月額 {yen(p.monthlyFee)}
                  <span className="ml-2 text-[14px] text-muted">成約手数料 {p.commissionBps / 100}%</span>
                </p>
                <ul className="mt-4 space-y-1.5 text-[13px]">
                  {(features.v2Journey ? V2_FEATURES : FEATURES).map((f) => {
                    const v = f[code];
                    return (
                      <li key={f.label} className={cn("flex items-center gap-2", !v && "text-muted/60 line-through")}>
                        <span aria-hidden>{v ? "✓" : "—"}</span>
                        {f.label}
                        {typeof v === "string" && <span className="text-[11px] text-muted">（{v}）</span>}
                      </li>
                    );
                  })}
                </ul>
                {owner && current !== code && (
                  <div className="mt-5">
                    <ChangePlanForm storeId={store.storeId} plan={code} label={`${p.name} に変更する`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-muted">
          月間の成約売上が {yen(BREAK_EVEN_GMV)} を超えると、STANDARD のほうが手数料の合計が安くなります。プラン変更は即時反映され、変更後の成約から新しい手数料率になります。
          {!owner && " プランの変更はオーナーのみ行えます。"}
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[16px] font-bold">いつもの出品（テンプレート）</h2>
        {templates.length === 0 ? (
          <p className="text-[13px] text-muted">出品時に「いつもの出品として保存する」を選ぶと、ここに追加されます。</p>
        ) : (
          <div className="card divide-y divide-line">
            {templates.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-[14px] font-bold">{t.name}</p>
                  <p className="tnum text-[12px] text-muted">
                    {t.pickupStart}〜{t.pickupEnd}・{t.quantity}
                    {t.isBox ? "BOX" : "点"}・{yen(t.rescuePrice)}
                    {t.autoRelist && t.autoRelistWeekdays.length > 0 && ` ・自動再出品：${t.autoRelistWeekdays.map(weekdayLabel).join("")}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {current === "standard" ? (
                    <form action={autoRelistAction} className="flex flex-wrap items-center gap-1.5 text-[12px]">
                      <input type="hidden" name="storeId" value={store.storeId} />
                      <input type="hidden" name="templateId" value={t.id} />
                      <label className="flex items-center gap-1 font-semibold">
                        <input type="checkbox" name="enabled" defaultChecked={t.autoRelist} className="accent-[var(--forest)]" />
                        自動再出品
                      </label>
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <label key={d} className="flex items-center gap-0.5">
                          <input type="checkbox" name="weekdays" value={d} defaultChecked={t.autoRelistWeekdays.includes(d)} className="accent-[var(--forest)]" />
                          {weekdayLabel(d)}
                        </label>
                      ))}
                      <button className="rounded-full border border-line px-2.5 py-1 font-semibold">保存</button>
                    </form>
                  ) : (
                    <span className="text-[11.5px] text-muted">自動再出品は STANDARD</span>
                  )}
                  <form action={deleteTemplateAction}>
                    <input type="hidden" name="storeId" value={store.storeId} />
                    <input type="hidden" name="templateId" value={t.id} />
                    <button className="rounded-full px-2.5 py-1 text-[12px] font-semibold text-muted hover:text-clay">削除</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 text-[16px] font-bold">店舗情報</h2>
          <div className="card p-5">
            <StoreInfoForm store={settings.store} editable={owner} v2={features.v2Journey} />
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <h2 className="mb-3 text-[16px] font-bold">メンバー</h2>
            <ul className="card divide-y divide-line text-[13px]">
              {settings.members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between px-4 py-3">
                  <span>{m.user_id === viewer.id ? `${viewer.displayName}（あなた）` : (m.display_name ?? "メンバー")}</span>
                  <Badge tone={m.role === "owner" ? "dark" : "outline"}>{m.role === "owner" ? "オーナー" : "スタッフ"}</Badge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">スタッフの追加は運営までご連絡ください（PoC 期間中）。</p>
          </div>
          {owner && (
            <div>
              <h2 className="mb-3 text-[16px] font-bold">ご請求（手数料）</h2>
              {settings.billing.length === 0 ? (
                <p className="text-[13px] text-muted">月次の請求データは、月末締めで作成されます。</p>
              ) : (
                <ul className="card divide-y divide-line text-[13px]">
                  {settings.billing.map((b) => (
                    <li key={b.period_month} className="flex items-center justify-between px-4 py-3">
                      <span className="tnum">{b.period_month}</span>
                      <span className="tnum font-semibold">{yen(b.total_amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
