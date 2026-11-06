import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/ops/client";
import { Card, Flash } from "@/components/ops/ui";
import { db } from "@/lib/ops/db";
import { deleteCampaign } from "../../../../actions";
import { CampaignForm } from "../../CampaignForm";

export const metadata = { title: "案件の編集" };

export default async function EditCampaign({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ flash?: string }> }) {
  const [{ id }, { flash }] = await Promise.all([params, searchParams]);
  const [c, restaurants] = await Promise.all([db.get("campaigns", id), db.list("restaurants")]);
  if (!c) notFound();
  return (
    <>
      <Flash text={flash} />
      <div className="flex items-center gap-3">
        <Link href={`/admin/campaigns/${id}`} className="text-sm text-muted">
          ← 案件に戻る
        </Link>
        <h1 className="text-xl font-extrabold md:text-2xl">案件の編集</h1>
      </div>
      <p className="text-sm text-muted">※ 送信済みの依頼の文面は変わりません。候補日を削除すると、その日を選んだ回答も無効になります。</p>
      <Card>
        <CampaignForm c={c} restaurants={restaurants} />
      </Card>
      <form action={deleteCampaign.bind(null, id)}>
        <SubmitButton variant="danger" size="sm" confirm="この案件と、すべての依頼・回答・インサイトを削除します。よろしいですか？">
          案件を削除
        </SubmitButton>
      </form>
    </>
  );
}
