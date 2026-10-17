import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addMemberAction, removeMemberAction, updateStoreAdminAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/admin/ActionButton";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { Badge } from "@/components/ui/Badge";
import { areaLabel } from "@/lib/categories";
import { dateTime, percent, yen } from "@/lib/format";
import { getAdminStore, listStoresWithMetrics } from "@/server/services/admin";

export const metadata: Metadata = { title: "店舗詳細" };

const RESULT_LABEL: Record<string, string> = {
  invalid_token: "無効なQR",
  store_inactive: "停止中の店舗",
  no_reservation: "予約なし",
  too_early: "受取前",
  window_closed: "受取時間外",
  already_completed: "完了済み",
  cancelled: "キャンセル済み",
};

export default async function AdminStorePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getAdminStore(id);
  if (!data) notFound();
  const s = data.store as Record<string, string | number | boolean>;
  const metrics = (await listStoresWithMetrics("30d")).find((m) => m.id === id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={String(s.name)}
        sub={
          <span>
            {areaLabel(String(s.area_id))}・/{String(s.slug)}・QR 第{String(s.qr_version)}版{s.is_demo ? "・デモ" : ""}
          </span>
        }
        action={
          <Link href={`/stores/${s.slug}`} className="text-[13px] font-semibold text-forest">
            ユーザー側の店舗ページ
          </Link>
        }
      />

      {metrics && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {[
            ["予約（30日）", metrics.reservations],
            ["成約", metrics.completed],
            ["予約→QR完了率", percent(metrics.qrRate)],
            ["GMV", yen(metrics.gmv)],
            ["手数料", yen(metrics.commission)],
          ].map(([label, value]) => (
            <div key={String(label)} className="card px-4 py-3">
              <p className="text-[12px] text-muted">{label}</p>
              <p className="tnum mt-1 text-[20px] font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-[15px] font-bold">ステータス・プラン</h2>
          <ActionForm action={updateStoreAdminAction} submitLabel="更新する" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="storeId" value={id} />
            <div>
              <label className="label" htmlFor="status">
                ステータス
              </label>
              <select id="status" name="status" defaultValue={String(s.status)} className="field w-40">
                <option value="pending">審査中</option>
                <option value="active">稼働中</option>
                <option value="suspended">停止中</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="plan">
                プラン
              </label>
              <select id="plan" name="plan" defaultValue={String(s.plan_code)} className="field w-40">
                <option value="free">FREE</option>
                <option value="standard">STANDARD</option>
              </select>
            </div>
          </ActionForm>
          {data.planChanges.length > 0 && (
            <ul className="mt-4 space-y-1 text-[12px] text-muted">
              {data.planChanges.map((p, i) => (
                <li key={i}>
                  {dateTime(p.created_at)} {p.from_plan.toUpperCase()} → {p.to_plan.toUpperCase()}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-[15px] font-bold">QRチェックインの失敗（30日）</h2>
          {data.failures.length === 0 ? (
            <p className="text-[13px] text-muted">記録はありません。</p>
          ) : (
            <ul className="space-y-1.5 text-[13px]">
              {data.failures.map((f) => (
                <li key={f.result} className="flex justify-between">
                  <span>{RESULT_LABEL[f.result] ?? f.result}</span>
                  <span className="tnum font-semibold">{f.count}件</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card p-5">
        <h2 className="mb-3 text-[15px] font-bold">メンバー（店舗ログインできるユーザー）</h2>
        <ul className="mb-4 divide-y divide-line text-[13px]">
          {data.members.length === 0 && <li className="py-2 text-muted">まだメンバーがいません。</li>}
          {data.members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="flex items-center gap-2">
                {m.display_name}
                <Badge tone={m.role === "owner" ? "dark" : "outline"}>{m.role === "owner" ? "オーナー" : "スタッフ"}</Badge>
                {!m.line_linked && <Badge tone="sand">LINE未連携</Badge>}
              </span>
              <form action={removeMemberAction}>
                <input type="hidden" name="storeId" value={id} />
                <input type="hidden" name="userId" value={m.user_id} />
                <button className="text-[12px] font-semibold text-muted hover:text-clay">外す</button>
              </form>
            </li>
          ))}
        </ul>
        <ActionForm action={addMemberAction} submitLabel="追加する" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="storeId" value={id} />
          <div className="min-w-[280px] flex-1">
            <label className="label" htmlFor="userId">
              ユーザーID（ユーザー一覧からコピー）
            </label>
            <input id="userId" name="userId" required className="field tnum" placeholder="00000000-0000-0000-0000-000000000000" />
          </div>
          <div>
            <label className="label" htmlFor="role">
              権限
            </label>
            <select id="role" name="role" className="field w-36">
              <option value="staff">スタッフ</option>
              <option value="owner">オーナー</option>
            </select>
          </div>
        </ActionForm>
        <p className="mt-3 text-[12px] text-muted">店舗の方に一度 LINE でログインしてもらい、ユーザー一覧に表示された ID を追加してください。</p>
      </section>
    </div>
  );
}
