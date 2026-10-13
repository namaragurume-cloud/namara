import { handleFormRequest } from "@/lib/form-handler";
import { partnerSchema } from "@/lib/validation";

export async function POST(req: Request) {
  return handleFormRequest(req, "partner", partnerSchema, (d) => ({
    subject: "【発信者登録申請】KITACRE",
    fields: [
      ["活動名・アカウント名", d.account],
      ["メールアドレス", d.email],
      ["InstagramまたはTikTokのURL", d.snsUrl],
      ["フォロワー数", d.followers.toLocaleString("ja-JP")],
      ["活動エリア", d.area],
      ["得意なグルメジャンル", d.genres.join("、") + (d.genreOther ? `（その他：${d.genreOther}）` : "")],
      ["自己PR・実績など", d.message],
      ["審査への同意", "同意済み"],
      ["個人情報の取扱い", "同意済み"],
    ],
  }));
}
