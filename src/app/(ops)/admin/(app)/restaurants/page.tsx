import Link from "next/link";
import { Badge, Card, Empty, Flash } from "@/components/ops/ui";
import { db } from "@/lib/ops/db";
import { RestaurantForm } from "./form";

export const metadata = { title: "飲食店" };

export default async function RestaurantsPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const { flash } = await searchParams;
  const [restaurants, campaigns] = await Promise.all([db.list("restaurants"), db.list("campaigns")]);
  const count = (id: string) => campaigns.filter((c) => c.restaurantId === id).length;
  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">飲食店</h1>
      <Card title={`登録済み ${restaurants.length}店舗`}>
        {restaurants.length === 0 ? (
          <Empty>まだ登録がありません。</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {restaurants
              .sort((a, b) => a.name.localeCompare(b.name, "ja"))
              .map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/restaurants/${r.id}`} className="flex flex-wrap items-center gap-x-3 py-2.5 hover:opacity-80">
                    <span className="font-bold">{r.name}</span>
                    {r.contactName && <span className="text-sm text-muted">{r.contactName}様</span>}
                    <span className="ml-auto flex items-center gap-2 text-xs text-muted">
                      {r.lineUserId ? <Badge tone="green">LINE</Badge> : <Badge>LINE未連携</Badge>}
                      案件 {count(r.id)}件
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </Card>
      <Card title="飲食店を登録">
        <RestaurantForm />
      </Card>
    </>
  );
}
