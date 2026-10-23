import type { Metadata } from "next";
import { Fill, LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "プライバシーポリシー（ドラフト）" };

export default function PrivacyPage() {
  return (
    <LegalPage title="プライバシーポリシー">
      <p>
        <Fill />（以下「当社」）は、TABETUNAGU における利用者の情報を、以下のとおり取り扱います。
      </p>
      <section>
        <h2>1. 取得する情報</h2>
        <p>現在のシステムで取得している情報（記載内容は専門家の確認が必要です）:</p>
        <ul className="list-disc pl-5">
          <li>LINE の表示名・ユーザー ID・プロフィール画像（LINE ログイン時。メールアドレスは取得しません）</li>
          <li>注文・お支払い・受取の履歴、つなぐポイントの履歴</li>
          <li>受取完了の操作時の IP アドレス・ブラウザの情報（不正防止のため）</li>
          <li>お気に入り店舗・通知設定</li>
          <li>決済に関する情報は決済代行会社（Stripe）が取得します。カード番号を当社は保持しません</li>
        </ul>
      </section>
      {["2. 利用目的", "3. 第三者提供（店舗への提供範囲を含む）", "4. 外部サービス（LINE・Stripe・ホスティング等）", "5. 安全管理", "6. 開示・訂正・削除の請求", "7. お問い合わせ窓口"].map((t) => (
        <section key={t}>
          <h2>{t}</h2>
          <p>
            <Fill>【要記入・専門家確認】</Fill>
          </p>
        </section>
      ))}
    </LegalPage>
  );
}
