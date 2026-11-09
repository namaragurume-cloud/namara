import Link from "next/link";
import { CreatorAvatar } from "@/components/ops/CreatorAvatar";
import { creatorIconUrl } from "@/lib/ops/creator-profile";
import { SubmitButton } from "@/components/ops/client";
import { Badge, Card, Empty, Field, Flash, inputClass } from "@/components/ops/ui";
import { fmtNum } from "@/lib/ops/dates";
import { db } from "@/lib/ops/db";
import { importCreators, saveCreator } from "../../actions";

export const metadata = { title: "発信者" };

export default async function CreatorsPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const { flash } = await searchParams;
  const creators = (await db.list("creators")).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "ja"));
  const linked = creators.filter((c) => c.lineUserId).length;
  return (
    <>
      <Flash text={flash} />
      <h1 className="text-xl font-extrabold md:text-2xl">発信者</h1>
      <Card title={`登録済み ${creators.length}人（LINE連携 ${linked}人）`}>
        {creators.length === 0 ? (
          <Empty>まだ登録がありません。下のフォームから登録してください。</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {creators.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/creators/${c.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 hover:opacity-80">
                  <CreatorAvatar name={c.name} src={creatorIconUrl(c)} size={28} />
                  <span className="font-bold">{c.name}</span>
                  {c.account && <span className="text-sm text-muted">@{c.account}</span>}
                  {c.followers && <span className="num text-xs text-muted">{fmtNum(c.followers)}人</span>}
                  {c.price ? <span className="num text-xs text-muted">料金 {fmtNum(c.price)}円</span> : <span className="text-xs text-amber-700">料金未設定</span>}
                  <span className="ml-auto flex gap-1.5">
                    {!c.active && <Badge>依頼対象外</Badge>}
                    {c.lineUserId ? <Badge tone="green">LINE連携済</Badge> : c.email ? <Badge tone="blue">メール</Badge> : <Badge tone="red">連絡手段なし</Badge>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="1人ずつ登録">
          <form action={saveCreator} className="space-y-3">
            <Field label="名前（呼び名）" required>
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Instagramアカウント" hint="@なしでOK">
              <input name="account" className={inputClass} placeholder="namaragurume" />
            </Field>
            <Field label="フォロワー数">
              <input name="followers" inputMode="numeric" className={inputClass} />
            </Field>
            <Field label="メールアドレス" hint="LINE未連携のときはメールで送ります">
              <input name="email" type="email" className={inputClass} />
            </Field>
            <input type="hidden" name="platform" value="Instagram" />
            <SubmitButton>登録する</SubmitButton>
          </form>
        </Card>
        <Card title="まとめて登録">
          <form action={importCreators} className="space-y-3">
            <Field label="1行に1人ずつ" hint="「名前, アカウント, フォロワー数, メール」の順にカンマ区切り（アカウント以降は省略可）。スプレッドシートからの貼り付けもOK。">
              <textarea name="rows" rows={9} className={inputClass} placeholder={"はなこ, hanako_gourmet, 32000\nたろう, taro_sapporo, 12000, taro@example.com"} />
            </Field>
            <SubmitButton>まとめて登録する</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
