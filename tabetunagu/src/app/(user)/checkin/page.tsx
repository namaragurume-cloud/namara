import type { Metadata } from "next";
import Link from "next/link";
import { QrScanner } from "@/components/checkin/QrScanner";
import { pickupLabel } from "@/lib/format";
import { requireViewer } from "@/server/auth/viewer";
import { listMyReservations } from "@/server/services/reservations";

export const metadata: Metadata = { title: "QRチェックイン" };

export default async function CheckinPage() {
  const viewer = await requireViewer("/checkin");
  const upcoming = await listMyReservations(viewer.id, "upcoming");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[20px] font-bold">QRチェックイン</h1>
        <p className="mt-1 text-[13px] text-muted">お店のレジ付近にある「TABETUNAGU」のQRコードを読み取ってください。</p>
      </div>
      <QrScanner />
      <section>
        <h2 className="mb-2 text-[13px] font-bold">今後の予約</h2>
        {upcoming.length === 0 ? (
          <p className="text-[13px] text-muted">
            有効な予約はありません。
            <Link href="/products" className="ml-1 font-semibold text-forest">
              商品をさがす
            </Link>
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((r) => (
              <li key={r.id}>
                <Link href={`/reservations/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{r.storeName}</span>
                    <span className="block truncate text-[12px] text-muted">{r.productName}</span>
                  </span>
                  <span className="tnum shrink-0 text-[12px] font-semibold">{pickupLabel(r.pickupStartAt, r.pickupEndAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-[11.5px] leading-relaxed text-muted">
        カメラが使えないときは、スマートフォンのカメラアプリで店頭のQRを読み取っても同じ画面が開きます。
      </p>
    </div>
  );
}
