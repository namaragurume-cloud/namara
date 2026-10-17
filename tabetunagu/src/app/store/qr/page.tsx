import type { Metadata } from "next";
import QRCode from "qrcode";
import { PageHeader } from "@/components/layout/ConsoleShell";
import { PrintButton } from "@/components/store/PrintButton";
import { RotateQrForm } from "@/components/store/StoreSettingsForms";
import { LogoMark } from "@/components/ui/Logo";
import { brand } from "@/lib/brand";
import { requireStoreMember } from "@/server/auth/viewer";
import { createStoreQrToken, storeQrUrl } from "@/server/qr";
import { getStoreQrVersion } from "@/server/services/store";

export const metadata: Metadata = { title: "QRコード" };

export default async function StoreQrPage() {
  const { viewer, store } = await requireStoreMember("/store/qr");
  const { qr_version, name } = await getStoreQrVersion(viewer.id, store.storeId);
  const url = storeQrUrl(createStoreQrToken(store.storeId, qr_version));
  const svg = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#16181a", light: "#ffffff" } });

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader title="QRコード" sub="印刷してレジ付近に貼ってください。お客様がこのQRを読み取ると、予約が「食べつなぎ完了」になります。" action={<PrintButton />} />
      </div>

      <div className="mx-auto max-w-[420px] rounded-[28px] border border-line bg-paper px-8 py-9 text-center print:max-w-none print:border-0">
        <div className="flex items-center justify-center gap-2 text-forest">
          <LogoMark className="h-9 w-9" />
          <span className="font-en text-[17px] font-semibold tracking-[0.2em] text-ink">TABETUNAGU</span>
        </div>
        <p className="mt-5 text-[20px] font-bold leading-snug">
          ご予約のお客様は
          <br />
          このQRを読み取ってください
        </p>
        <div className="mx-auto mt-6 w-[260px] [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="mt-5 text-[15px] font-bold">{name}</p>
        <p className="mt-1 text-[12px] text-muted">読み取り後、いつものレジでお支払いください。</p>
        <p className="mt-6 text-[11px] tracking-[0.2em] text-forest">{brand.tagline}</p>
      </div>

      <div className="no-print mx-auto max-w-[420px] space-y-3 text-[12px] text-muted">
        <p>QRには店舗を示す署名付きのコードが入っています（第{qr_version}版）。コピーされた疑いがあるときは再発行できます。</p>
        <p className="break-all text-[11px]">
          QRのURL：<span data-testid="store-qr-url">{url}</span>
        </p>
        {store.role === "owner" && <RotateQrForm storeId={store.storeId} />}
      </div>
    </div>
  );
}
