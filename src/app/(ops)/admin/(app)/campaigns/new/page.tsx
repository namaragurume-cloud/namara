import Link from "next/link";
import { Card, Flash } from "@/components/ops/ui";
import { db } from "@/lib/ops/db";
import { RestaurantForm } from "../../restaurants/form";
import { CampaignForm } from "../CampaignForm";

export const metadata = { title: "新しい案件" };

export default async function NewCampaign({ searchParams }: { searchParams: Promise<{ flash?: string; restaurant?: string; from?: string }> }) {
  const { flash, restaurant, from } = await searchParams;
  const [restaurants, campaigns] = await Promise.all([db.list("restaurants"), db.list("campaigns")]);
  restaurants.sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const copy = from ? campaigns.find((c) => c.id === from) : undefined;
  const recent = campaigns.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const rName = new Map(restaurants.map((r) => [r.id, r.name]));
  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">新しい案件</h1>
      {restaurants.length === 0 ? (
        <Card title="まず飲食店を登録してください">
          <RestaurantForm next="campaign" />
        </Card>
      ) : (
        <>
          {recent.length > 0 && !copy && (
            <p className="text-sm text-muted">
              前の案件を下書きにする：
              {recent.map((c) => (
                <Link key={c.id} href={`/admin/campaigns/new?from=${c.id}`} className="ml-2 font-bold text-brand underline">
                  {rName.get(c.restaurantId)}「{c.title}」
                </Link>
              ))}
            </p>
          )}
          <Card>
            <CampaignForm restaurants={restaurants} restaurantId={restaurant} copy={copy} />
          </Card>
          <p className="text-sm text-muted">
            店舗が一覧にない場合は <Link href="/admin/restaurants" className="font-bold underline">飲食店</Link> から登録してください。
          </p>
        </>
      )}
    </>
  );
}
