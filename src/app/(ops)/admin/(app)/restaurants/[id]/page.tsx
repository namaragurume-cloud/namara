import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink, Card, Flash } from "@/components/ops/ui";
import { fmtDate } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { RestaurantForm } from "../form";

export const metadata = { title: "飲食店の詳細" };

export default async function RestaurantPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ id }, { flash }] = await Promise.all([params, searchParams]);
  const r = await db.get("restaurants", id);
  if (!r) notFound();
  const campaigns = (await db.list("campaigns")).filter((c) => c.restaurantId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <Flash text={flash} />
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/restaurants" className="text-sm text-muted">
          ← 飲食店
        </Link>
        <h1 className="text-xl font-extrabold md:text-2xl">{r.name}</h1>
        <ButtonLink href={`/admin/campaigns/new?restaurant=${r.id}`} size="sm" className="ml-auto">
          ＋ この店舗の案件をつくる
        </ButtonLink>
      </div>
      <Card title="案件">
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted">まだ案件はありません。</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/campaigns/${c.id}`} className="flex gap-3 py-2 hover:text-brand">
                  <span className="font-bold">{c.title}</span>
                  <span className="ml-auto text-xs text-muted">作成 {fmtDate(c.createdAt.slice(0, 10))}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="登録内容">
        <RestaurantForm r={r} />
      </Card>
    </>
  );
}
