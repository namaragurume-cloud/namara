import { handleFormRequest } from "@/lib/form-handler";
import { contactSchema } from "@/lib/validation";

export async function POST(req: Request) {
  return handleFormRequest(req, "contact", contactSchema, (d) => ({
    subject: "【企業問い合わせ】MIRATSUMU",
    fields: [
      ["企業名・店舗名", d.company],
      ["メールアドレス", d.email],
      ["PRの目的", d.purpose],
      ["ご予算", d.budget],
      ["ご相談内容", d.message],
      ["ご担当者名", d.name],
      ["業種", d.industry],
      ["PRしたい商品・サービス", d.product],
      ["希望実施時期", d.timing],
      ["希望インフルエンサー", d.creator],
      ["個人情報の取扱い", "同意済み"],
    ],
  }));
}
