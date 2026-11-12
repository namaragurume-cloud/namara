import { handleFormRequest } from "@/lib/form-handler";
import { corpContactSchema } from "@/lib/validation";

export async function POST(req: Request) {
  return handleFormRequest(req, "corp", corpContactSchema, (d) => ({
    subject: "【お問い合わせ】株式会社North Pleasure",
    fields: [
      ["お名前", d.name],
      ["会社名・店舗名", d.company],
      ["メールアドレス", d.email],
      ["お問い合わせの種類", d.category],
      ["お問い合わせ内容", d.message],
      ["個人情報の取扱い", "同意済み"],
    ],
  }));
}
