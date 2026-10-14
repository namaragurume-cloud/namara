import { handleFormRequest } from "@/lib/form-handler";
import { contactSchema } from "@/lib/validation";

export async function POST(req: Request) {
  return handleFormRequest(req, "contact", contactSchema, (d) => ({
    subject: "【企業問い合わせ】MIRATSUMU",
    fields: [
      ["会社名・店舗名", d.company],
      ["ご担当者名", d.name],
      ["メールアドレス", d.email],
      ["業種", d.industry],
      ["PRしたい商品・サービス", d.product],
      ["ご予算", d.budget],
      ["希望実施時期", d.timing],
      ["希望インフルエンサー", d.creator],
      ["お問い合わせ内容", d.message],
      ["個人情報の取扱い", "同意済み"],
    ],
  }));
}
