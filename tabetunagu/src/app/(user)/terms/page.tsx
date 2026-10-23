import type { Metadata } from "next";
import { Fill, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "利用規約（ドラフト）" };

const SECTIONS = [
  "第1条（適用）",
  "第2条（定義）",
  "第3条（利用登録・LINE アカウントでのログイン）",
  "第4条（サービスの内容: 店舗の商品の注文・事前決済・受取）",
  "第5条（料金・つなぐチャージ・お支払い）",
  "第6条（つなぐポイント）",
  "第7条（キャンセル・返金）",
  "第8条（商品の受取・受取完了の操作）",
  "第9条（商品の品質・アレルギー等の情報）",
  "第10条（禁止事項）",
  "第11条（サービスの変更・停止）",
  "第12条（免責）",
  "第13条（規約の変更）",
  "第14条（準拠法・管轄）",
];

export default function TermsPage() {
  return (
    <LegalPage title="利用規約">
      <p>
        本規約は、<Fill />（以下「当社」）が提供する TABETUNAGU（食べつなぐ）の利用条件を定めるものです。
      </p>
      {SECTIONS.map((s) => (
        <section key={s}>
          <h2>{s}</h2>
          <p>
            <Fill>【要記入・専門家確認】</Fill>
          </p>
        </section>
      ))}
    </LegalPage>
  );
}
