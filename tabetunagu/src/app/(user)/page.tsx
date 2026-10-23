import { ArrowRight, CreditCard, Hand, QrCode, Store, Ticket } from "lucide-react";
import Link from "next/link";
import { ProductCard, ProductRow } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { ChipLink, ChipRow } from "@/components/ui/Chip";
import { EmptyState, SectionTitle } from "@/components/ui/Section";
import { brand } from "@/lib/brand";
import { AREAS, CATEGORIES } from "@/lib/categories";
import { features } from "@/lib/features";
import { getViewer } from "@/server/auth/viewer";
import { countByArea, listAvailableProducts, sortProducts } from "@/server/services/catalog";

const LEGACY_STEPS = [
  { Icon: Ticket, title: "予約する", body: "気になる商品を選んで「食べつなぐ」。受取時間を確認して予約します。" },
  { Icon: QrCode, title: "お店でQRを読み取る", body: "受取時間内にお店へ。店頭のQRコードを読み取ると「食べつなぎ完了」。" },
  { Icon: Store, title: "いつものレジで支払う", body: "お支払いはお店で。現金・カード・QR決済など、お店の方法でどうぞ。" },
];

/** v2（事前決済）の流れ */
const V2_STEPS = [
  { Icon: CreditCard, title: "食べつなぐ", body: "気になる商品を選んで、オンラインで先にお支払い。受取チケットが届きます。" },
  { Icon: Ticket, title: "お店で受取チケットを見せる", body: "受取時間内にお店へ。スタッフに受取チケットの画面を見せて、商品を受け取ります。" },
  { Icon: Hand, title: "スワイプして受取完了", body: "受け取ったら、ご自身で「受取完了」をスワイプ。お会計はありません。" },
];

export default async function HomePage() {
  const viewer = await getViewer();
  const v2 = features.v2Journey;
  const now = new Date();
  const all = await listAvailableProducts(viewer?.id ?? null, {}, now);
  const available = all.filter((p) => p.status === "published" && p.remaining > 0);
  const counts = countByArea(all);
  const recommended = sortProducts(available, "recommended", undefined, now).slice(0, 6);
  const endingSoon = sortProducts(available, "ending", undefined, now)
    .filter((p) => !recommended.slice(0, 3).some((r) => r.id === p.id))
    .slice(0, 4);

  return (
    <div className="space-y-8">
      <section className="pt-2">
        <p className="text-[12px] font-semibold tracking-[0.2em] text-forest">{v2 ? "近くのおいしいを、おトクに。" : brand.tagline}</p>
        <h1 className="mt-2 text-[26px] font-bold leading-snug tracking-wide text-ink">
          {available.length > 0 ? (
            <>
              いま<span className="tnum mx-1 text-forest">{available.length}</span>件、
              <br />
              食べつなげます。
            </>
          ) : (
            <>
              捨てられるはずだった、
              <br />
              おいしさを。次の人へ。
            </>
          )}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          {v2
            ? "近くのお店の今日のおいしさを、食べつなぎ価格で。先にお支払いして、お店で受け取るだけ。食べつなぐことが、食品ロスを減らすことにもつながります。"
            : "近くのお店の今日のおいしさを、食べつなぎ価格で。予約して、お店で受け取るだけ。"}
        </p>
      </section>

      <section aria-label="エリア">
        <div className="grid grid-cols-3 gap-2">
          {AREAS.filter((a) => a.id !== "other").map((a) => (
            <Link key={a.id} href={`/products?area=${a.id}`} className="rounded-2xl bg-canvas px-3 py-3 transition-colors hover:bg-sand">
              <p className="text-[12px] font-semibold text-ink-2">{a.label}</p>
              <p className="tnum mt-0.5 text-[20px] font-semibold text-ink">
                {counts.get(a.id) ?? 0}
                <span className="ml-0.5 text-[11px] font-semibold text-muted">件</span>
              </p>
            </Link>
          ))}
        </div>
        <ChipRow className="mt-3">
          {CATEGORIES.map((c) => (
            <ChipLink key={c.id} href={`/products?category=${c.id}`}>
              {c.label}
            </ChipLink>
          ))}
        </ChipRow>
      </section>

      {available.length === 0 ? (
        <EmptyState
          title="今日の出品はまだありません"
          body="お店の閉店前、夕方から夜にかけて出品が増えます。少し時間をおいて、またのぞいてみてください。"
        />
      ) : (
        <>
          <section>
            <SectionTitle
              title="今日のおすすめ"
              action={
                <Link href="/products" className="flex items-center gap-1 text-[12px] font-semibold text-forest">
                  すべて見る <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
              {recommended.map((p, i) => (
                <div key={p.id} className="w-[72%] max-w-[300px] shrink-0 snap-start">
                  <ProductCard product={p} priority={i < 2} />
                </div>
              ))}
            </div>
          </section>

          {endingSoon.length > 0 && (
            <section>
              <SectionTitle title="まもなく受取終了" sub="受取時間が近いものから" />
              <div className="space-y-2.5">
                {endingSoon.map((p) => (
                  <ProductRow key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-3xl bg-canvas px-5 py-6">
        <p className="text-[12px] font-semibold tracking-[0.2em] text-forest">HOW IT WORKS</p>
        <h2 className="mt-1 text-[17px] font-bold">{brand.philosophy}</h2>
        <ol className="mt-4 space-y-3.5">
          {(v2 ? V2_STEPS : LEGACY_STEPS).map(({ Icon, title, body }, i) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-forest">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div>
                <p className="text-[14px] font-bold">
                  <span className="tnum mr-1.5 text-muted">0{i + 1}</span>
                  {title}
                </p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        {!viewer && (
          <ButtonLink href="/login" variant="dark" className="mt-5 w-full">
            はじめる
          </ButtonLink>
        )}
      </section>
    </div>
  );
}
