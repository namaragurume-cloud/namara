import Link from "next/link";
import { Card, Flash } from "@/components/ops/ui";
import { db } from "@/lib/ops/db";
import { RestaurantForm } from "../../restaurants/form";
import { CampaignForm } from "../CampaignForm";

export const metadata = { title: "新しい案件" };

export default async function NewCampaign({ searchParams }: { searchParams: Promise<{ flash?: string; restaurant?: string; from?: string; proposal?: string }> }) {
  const { flash, restaurant, from, proposal: proposalId } = await searchParams;
  const [restaurants, campaigns, prop] = await Promise.all([db.list("restaurants"), db.list("campaigns"), proposalId ? db.get("proposals", proposalId) : null]);
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
          {recent.length > 0 && !copy && !prop && (
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
            {prop && (
              <p className="mb-4 rounded-xl bg-brand/5 px-4 py-2 text-sm">
                提案「{prop.text?.title ?? "提案"}」から案件をつくります。保存すると、提案で選んだ発信者に依頼を送る画面に進みます（発信者にはチェックが入っています）。
              </p>
            )}
            <CampaignForm restaurants={restaurants} restaurantId={restaurant ?? prop?.restaurantId} copy={copy} proposal={prop ? { id: prop.id, title: campaignTitle(prop.text?.title, restaurants.find((r) => r.id === prop.restaurantId)?.name) } : undefined} />
          </Card>
          <p className="text-sm text-muted">
            店舗が一覧にない場合は <Link href="/admin/restaurants" className="font-bold underline">飲食店</Link> から登録してください。
          </p>
        </>
      )}
    </>
  );
}

/** 「〇〇様 冬の新メニューPRのご提案」→「冬の新メニューPR」 */
function campaignTitle(title?: string, shop?: string): string | undefined {
  if (!title) return undefined;
  let t = title.replace(/の?ご提案$/, "").trim();
  if (shop && t.startsWith(shop)) t = t.slice(shop.length).replace(/^\s*(様|御中)?\s*/, "");
  return t || title;
}
