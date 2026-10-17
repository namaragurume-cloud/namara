import { Store } from "lucide-react";
import type { Metadata } from "next";
import { CheckinForm } from "@/components/checkin/CheckinForm";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Section";
import { pickupLabel } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { verifyStoreQrToken } from "@/server/qr";
import { previewCheckin } from "@/server/services/checkin";

export const metadata: Metadata = { title: "受け取りの確認", robots: { index: false } };

/**
 * 店頭QRを読み取ったときに開く画面。
 * GET では状態を変えない（リンクのプレビュー等で勝手に完了しないように）。ボタンで確定する。
 */
export default async function StoreQrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!verifyStoreQrToken(token)) {
    return (
      <div className="space-y-4 pt-6">
        <h1 className="text-[20px] font-bold">QRコードを確認できませんでした</h1>
        <Notice tone="error">このQRコードは無効か、古いものです。お手数ですが、店舗スタッフにお声がけください。</Notice>
        <ButtonLink href="/checkin" variant="secondary" className="w-full">
          もう一度読み取る
        </ButtonLink>
      </div>
    );
  }
  const viewer = await requireViewer(`/c/${token}`);
  const preview = await previewCheckin(viewer.id, token);
  if (!preview) {
    return (
      <div className="space-y-4 pt-6">
        <h1 className="text-[20px] font-bold">QRコードを確認できませんでした</h1>
        <Notice tone="error">このQRコードは再発行され、使えなくなっています。店舗スタッフにお声がけください。</Notice>
      </div>
    );
  }
  const { store, reservations } = preview;
  return (
    <div className="space-y-5 pt-2">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-leaf-soft text-forest">
          <Store className="h-6 w-6" aria-hidden />
        </span>
        <p className="mt-3 text-[12px] font-semibold tracking-[0.2em] text-forest">CHECK IN</p>
        <h1 className="mt-1 text-[22px] font-bold">{store.name}</h1>
      </div>

      {!store.active ? (
        <Notice tone="error">この店舗は現在、受付を停止しています。</Notice>
      ) : reservations.length === 0 ? (
        <div className="space-y-3">
          <Notice>この店舗での有効な予約はありません。すでに受け取り済みの場合は、予約一覧の「過去の食べつなぎ」をご確認ください。</Notice>
          <ButtonLink href="/reservations?tab=past" variant="secondary" className="w-full">
            予約一覧を見る
          </ButtonLink>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {reservations.map((r) => (
              <li key={r.id} className="rounded-2xl border border-line px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-[15px] font-bold">{r.productName}</p>
                  <p className="tnum shrink-0 text-[13px] font-semibold">
                    {r.quantity}
                    {r.isBox ? "BOX" : "点"}
                  </p>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-muted">
                  <span className="tnum">
                    予約番号 <span className="font-semibold tracking-wider text-ink">{r.code}</span>
                  </span>
                  <span className="tnum">{pickupLabel(r.pickupStartAt, r.pickupEndAt)}</span>
                </div>
              </li>
            ))}
          </ul>
          <CheckinForm token={token} />
        </>
      )}
    </div>
  );
}
