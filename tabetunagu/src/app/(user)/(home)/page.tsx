import { ArrowRight, CreditCard, Hand, Leaf, QrCode, Store, Ticket } from "lucide-react";
import Link from "next/link";
import { DealCard, DealRow } from "@/components/home/DealCard";
import { AreaPicker, CategoryRail } from "@/components/home/HomeFilters";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, SectionTitle } from "@/components/ui/Section";
import { AREAS } from "@/lib/categories";
import { homeSections } from "@/lib/deals";
import { features } from "@/lib/features";
import type { ProductCard } from "@/lib/types";
import { getViewer } from "@/server/auth/viewer";
import { countByArea, listAvailableProducts } from "@/server/services/catalog";

const LEGACY_STEPS = [
  { Icon: Ticket, title: "予約する", body: "気になる商品を選んで「食べつなぐ」。受取時間を確認して予約します。" },
  { Icon: QrCode, title: "お店でQRを読み取る", body: "受取時間内にお店へ。店頭のQRコードを読み取ると「食べつなぎ完了」。" },
  { Icon: Store, title: "いつものレジで支払う", body: "お支払いはお店で。現金・カード・QR決済など、お店の方法でどうぞ。" },
];

/** v2（事前決済）の流れ */
const V2_STEPS = [
  { Icon: CreditCard, title: "食べつなぐ", body: "商品を選んで、オンラインで先にお支払い。" },
  { Icon: Ticket, title: "受取チケット", body: "受取時間にお店へ。スタッフに画面を見せます。" },
  { Icon: Hand, title: "スワイプ", body: "商品を受け取ったら、ご自身でスワイプして完了。" },
];

/** ホームのエリア（札幌 PoC）。「その他」のエリアは「すべて」に含め、ボタンは出さない（商品一覧では選べる） */
const HOME_AREAS = AREAS.filter((a) => a.id !== "other");

export default async function HomePage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area: rawArea } = await searchParams;
  const area = AREAS.some((a) => a.id === rawArea) ? rawArea : undefined;
  const viewer = await getViewer();
  const v2 = features.v2Journey;
  const now = new Date();
  // 商品の取得はこの1回だけ（おすすめ順: 受付中 → STANDARD の優先掲載 → 受取開始済み → お得度 → 終了が近い順）。
  // エリアの件数・各セクションは、この結果を絞り込み・並べ替えて作る
  const all = await listAvailableProducts(viewer?.id ?? null, {}, now);
  const counts = countByArea(all);
  const { available, readyNow, recommended, endingSoon, boxes } = homeSections(all, now, area);
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const areas = HOME_AREAS.map((a) => ({ id: a.id, label: a.label, count: counts.get(a.id) ?? 0 }));
  const areaName = area ? AREAS.find((a) => a.id === area)?.label : undefined;
  const listHref = area ? `/products?area=${area}` : "/products";

  return (
    <div className="space-y-7">
      <section className="pt-1" aria-labelledby="home-title">
        <h1 id="home-title" className="text-[22px] font-bold leading-snug tracking-wide text-ink">
          近くのおいしいを、おトクに。
        </h1>
        <p className="mt-1 text-[13px] text-muted">今日だけの食べつなぎ価格を、LINEからかんたんに。</p>
        <div className="mt-3 rounded-2xl bg-leaf-soft px-4 py-3" data-testid="available-count">
          <p className="text-[16px] font-bold text-forest">
            {areaName && <span className="mr-1">{areaName}で</span>}
            いま<span className="tnum mx-0.5 text-[24px] leading-none">{available.length}</span>件、食べつなげます。
          </p>
          <p className="mt-1 flex flex-wrap gap-x-2 text-[11.5px] text-forest">
            <span>本日受取・在庫ありの商品</span>
            {readyNow > 0 && <span className="tnum font-semibold">うち{readyNow}件はすぐ受取OK</span>}
          </p>
        </div>
      </section>

      <AreaPicker areas={areas} selected={area} total={total} />
      <CategoryRail area={area} />

      {available.length === 0 ? (
        <EmptyState
          title={area ? `${areaName}には、いま食べつなげる商品はありません。` : "現在、食べつなげる商品はありません。"}
          body="お店の閉店前、夕方から夜にかけて出品が増えます。新しい商品が出たら、また見にきてください。"
          action={
            area && total > 0 ? (
              <ButtonLink href="/" variant="secondary">
                すべてのエリアを見る
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <>
          {recommended.length > 0 && (
            <HomeSection id="recommended" title="今日のおすすめ" href={listHref}>
              <Carousel items={recommended} now={now} priorityFirst />
            </HomeSection>
          )}

          {endingSoon.length > 0 && (
            <HomeSection id="ending-soon" title="まもなく受取終了" sub="受取終了が近いものから">
              <div className="space-y-2.5">
                {endingSoon.map((p) => (
                  <DealRow key={p.id} product={p} now={now} />
                ))}
              </div>
            </HomeSection>
          )}

          {boxes.length > 0 && (
            <HomeSection id="boxes" title="今日の食べつなぎBOX" sub="中身は当日のお楽しみ。おトクに食べつなごう。">
              <Carousel items={boxes} now={now} />
            </HomeSection>
          )}
        </>
      )}

      <section className="rounded-3xl bg-canvas px-5 py-5" aria-labelledby="first-time-title" data-testid="first-time">
        <h2 id="first-time-title" className="text-[15px] font-bold">
          はじめての方へ
        </h2>
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {(v2 ? V2_STEPS : LEGACY_STEPS).map(({ Icon, title, body }, i) => (
            <li key={title} className="flex flex-col items-center text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-forest">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <p className="mt-1.5 text-[12.5px] font-bold leading-tight">
                <span className="tnum sr-only">{i + 1}. </span>
                {title}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted">{body}</p>
            </li>
          ))}
        </ol>
        {!viewer && (
          <ButtonLink href="/login" variant="dark" className="mt-4 w-full">
            はじめる
          </ButtonLink>
        )}
      </section>

      <p className="flex items-center justify-center gap-1.5 text-center text-[12px] text-muted" data-testid="food-loss-note">
        <Leaf className="h-3.5 w-3.5 shrink-0 text-leaf" aria-hidden />
        おいしく食べつなぐことが、食品ロス削減にもつながります。
      </p>
    </div>
  );
}

function HomeSection({
  id,
  title,
  sub,
  href,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-title`} data-testid={`home-${id}`}>
      <SectionTitle
        id={`${id}-title`}
        title={title}
        sub={sub}
        action={
          href ? (
            <Link href={href} className="flex min-h-[32px] items-center gap-1 text-[12px] font-semibold text-forest">
              すべて見る <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : undefined
        }
      />
      {children}
    </section>
  );
}

function Carousel({ items, now, priorityFirst }: { items: ProductCard[]; now: Date; priorityFirst?: boolean }) {
  return (
    <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
      {items.map((p, i) => (
        <li key={p.id} className="w-[72%] max-w-[280px] shrink-0 snap-start">
          <DealCard product={p} now={now} priority={priorityFirst && i < 2} />
        </li>
      ))}
    </ul>
  );
}
