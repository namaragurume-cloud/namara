import { privacyMeta } from "@/data/privacy";
import { site } from "@/data/site";
import { pageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "プライバシーポリシー",
  description: `${site.company.name}（KITACRE／なまらグルメ）における個人情報の取扱いについて。`,
  path: "/privacy",
});

/** 公開前の確認メモ（finalized にすると非表示） */
function Todo({ children }: { children: React.ReactNode }) {
  if (privacyMeta.finalized) return null;
  return <span className="mt-2 block text-xs text-muted">{children}</span>;
}

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. 基本方針",
    body: (
      <p>
        {site.company.name}
        （以下「当社」）は、当社が運営する「なまらグルメ」およびクリエイターキャスティングサービス「KITACRE」（以下「本サービス」）において取得する個人情報を、個人情報の保護に関する法律その他の関係法令を遵守し、適切に取り扱います。
      </p>
    ),
  },
  {
    title: "2. 取得する個人情報",
    body: (
      <>
        <p>当社は、本ウェブサイトのフォーム等を通じて、以下の情報を取得します。</p>
        <h3 className="mt-4 font-bold">企業向けお問い合わせフォーム</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>会社名・店舗名、ご担当者名、メールアドレス</li>
          <li>業種、PRしたい商品・サービス、ご予算、希望実施時期、希望インフルエンサー、お問い合わせ内容</li>
        </ul>
        <h3 className="mt-4 font-bold">インフルエンサー登録フォーム</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>活動名・アカウント名、メールアドレス</li>
          <li>InstagramまたはTikTokのURL、フォロワー数、活動エリア、得意なグルメジャンル、自己PR等</li>
        </ul>
        <p className="mt-4">
          このほか、Instagram
          のダイレクトメッセージ等でご連絡いただいた場合は、その内容およびアカウント情報を取得します。また、フォームの不正利用防止のため、送信元のIPアドレス等を一時的に利用する場合があります。
        </p>
      </>
    ),
  },
  {
    title: "3. 利用目的",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>お問い合わせ・ご相談への回答、ご提案、お見積もりのため</li>
        <li>本サービスの提供、契約の締結・履行、ご連絡のため</li>
        <li>インフルエンサー登録の内容確認・審査、および案件のご案内のため</li>
        <li>本サービスの改善、新サービスの検討のため（個人を特定しない統計情報として利用）</li>
        <li>不正行為・スパム送信の防止のため</li>
      </ul>
    ),
  },
  {
    title: "4. 業務委託先・外部サービスの利用",
    body: (
      <p>
        当社は、フォーム送信内容の通知メールの配信、ウェブサイトの運用等のため、外部の事業者が提供するサービス（メール配信サービス、フォーム送信サービス、ホスティングサービス、Bot対策サービス等）を利用する場合があります。これらのサービスの利用にあたり、利用目的の達成に必要な範囲で個人情報の取扱いを委託することがあります。その場合、委託先を適切に選定し、必要かつ適切な監督を行います。
        <Todo>【要確認】実際に利用するサービス名（例：Vercel、Resend、Formspree、Cloudflare Turnstile、Google Analytics 等）と、海外の事業者の場合の所在国の記載要否</Todo>
      </p>
    ),
  },
  {
    title: "5. 第三者提供",
    body: (
      <>
        <p>当社は、次の場合を除き、ご本人の同意なく個人情報を第三者に提供しません。</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>法令に基づく場合</li>
          <li>人の生命、身体または財産の保護のために必要があり、ご本人の同意を得ることが困難な場合</li>
          <li>前項の業務委託に伴って提供する場合</li>
        </ul>
        <p className="mt-2">
          なお、キャスティング業務の遂行にあたり、企業様の案件情報を発信者に、発信者の活動情報を企業様に共有する場合は、事前にご本人の同意を得たうえで、必要な範囲で行います。
        </p>
      </>
    ),
  },
  {
    title: "6. 安全管理措置",
    body: (
      <p>
        当社は、個人情報の漏えい、滅失またはき損を防止するため、アクセス権限の管理、通信の暗号化、取り扱う者の限定など、必要かつ適切な安全管理措置を講じます。
      </p>
    ),
  },
  {
    title: "7. 保存期間・削除",
    body: (
      <p>
        当社は、利用目的の達成に必要な期間に限り個人情報を保存し、不要となった場合は遅滞なく削除または廃棄します。
        <Todo>【要確認】具体的な保存期間（例：最終のご連絡から○年）</Todo>
      </p>
    ),
  },
  {
    title: "8. アクセス解析・Cookieについて",
    body: (
      <p>
        本ウェブサイトでは、サイトの利用状況を把握し改善に役立てるため、Cookie等を利用したアクセス解析ツールを使用する場合があります。これらのツールにより収集される情報は、個人を特定するものではありません。Cookieの利用は、ブラウザの設定により無効にすることができます。
        <Todo>【要確認】導入する解析ツール名と、オプトアウト方法へのリンク</Todo>
      </p>
    ),
  },
  {
    title: "9. 開示等の請求・お問い合わせ窓口",
    body: (
      <>
        <p>
          ご本人からの個人情報の開示、訂正、利用停止、削除等のご請求には、ご本人であることを確認のうえ、法令に従い対応します。ご請求およびお問い合わせは、以下の窓口までご連絡ください。
        </p>
        <div className="mt-4 rounded-xl bg-mist p-5 text-sm">
          <p>{site.company.name}　個人情報お問い合わせ窓口</p>
          <p>所在地：{site.company.address}</p>
          <p>お問い合わせ：本ウェブサイトのお問い合わせフォーム、または Instagram（{site.instagram.handle}）</p>
        </div>
      </>
    ),
  },
  {
    title: "10. 本ポリシーの変更",
    body: <p>当社は、必要に応じて本ポリシーを変更することがあります。変更後の内容は、本ページに掲載した時点から効力を生じます。</p>,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageHero en="PRIVACY POLICY" title="プライバシーポリシー" breadcrumb={[{ label: "プライバシーポリシー", href: "/privacy" }]} />
      <section className="section">
        <div className="container-x max-w-3xl!">
          {!privacyMeta.finalized && (
            <p role="note" className="mb-12 rounded-xl border border-brand/30 bg-brand/5 p-5 text-sm leading-relaxed text-brand">
              本ポリシーは公開前の確認用ドラフトです。実際に利用するサービス・管理体制に合わせて内容を確定させる予定です。
            </p>
          )}
          <div className="space-y-12 text-[15px] leading-[2]">
            {sections.map((s) => (
              <section key={s.title}>
                <h2 className="mb-4 text-lg font-bold md:text-xl">{s.title}</h2>
                <div className="text-ink/80">{s.body}</div>
              </section>
            ))}
          </div>
          <p className="mt-16 text-right text-sm text-muted">
            {privacyMeta.enactedAt ? `制定日：${privacyMeta.enactedAt}` : "制定日：公開時に記載"}
            <br />
            {site.company.name}
          </p>
        </div>
      </section>
    </>
  );
}
