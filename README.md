# MIRATSUMU（ミラツム）公式サイト

北海道発のクリエイターキャスティングサービス「MIRATSUMU（ミラツム）」の公式サイトです。運営メディアは「なまらグルメ」です。

- Next.js 16（App Router）/ React 19 / TypeScript
- Tailwind CSS v4 / Motion / Lucide Icons / Zod
- Vercel へのデプロイを想定（CMS なし。内容は `src/data/` のファイルで管理）

> 以前の静的 HTML 版（`index.html` / `privacy.html` / `css/` / `js/`）はこの Next.js 版に置き換えました。過去の内容は Git の履歴から参照できます。

---

## 1. ローカルで起動する

必要なもの：Node.js 20.9 以上（推奨 22）

```bash
npm install
cp .env.example .env.local   # 必要に応じて値を設定
npm run dev                  # http://localhost:3000
```

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番ビルドの起動 |
| `npm run lint` | ESLint |
| `npm run typecheck` | 型チェック |

ローカルでフォームを試すときは `.env.local` に `MAIL_PROVIDER=console` を設定すると、送信内容がターミナルに表示されます（メールは送信されません。本番では無効）。

---

## 2. Vercel で公開する

1. GitHub のこのリポジトリを Vercel にインポート（Framework は自動で Next.js になります）
2. Project Settings → Environment Variables に「3. 環境変数」の値を設定
3. Deploy
4. 独自ドメインを決めたら Vercel の Domains で設定し、`NEXT_PUBLIC_SITE_URL` をそのドメインに変更して再デプロイ

---

## 3. 環境変数

`.env.example` に一覧があります。秘密情報（API キー）は `.env.local` か Vercel の設定画面にのみ保存し、Git にコミットしないでください。

| 変数 | 必須 | 内容 |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ○ | 公開 URL（canonical / OGP / sitemap に使用） |
| `MAIL_PROVIDER` | ○ | `resend` / `formspree` / `console`（開発用） |
| `MAIL_TO` | resend 時 | 通知先（既定 `namaragurume@gmail.com`）。カンマ区切りで複数可 |
| `RESEND_API_KEY` | resend 時 | Resend の API キー |
| `MAIL_FROM` | resend 時 | 送信元（Resend で認証済みのドメインのアドレス） |
| `FORMSPREE_CONTACT_FORM_ID` | formspree 時 | 企業問い合わせ用フォーム ID |
| `FORMSPREE_PARTNER_FORM_ID` | 任意 | 発信者登録用フォーム ID（空なら企業問い合わせ用と共用） |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | 任意（推奨） | Cloudflare Turnstile（Bot 対策） |
| `NEXT_PUBLIC_GA_ID` | 任意 | Google Analytics 4 の測定 ID |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` / `INSTAGRAM_ACCESS_TOKEN` | 任意 | Instagram フォロワー数の自動取得（下記参照） |
| `CONTENT_PREVIEW` | 任意 | `true` で非公開の実績・発信者をプレビュー表示（ローカル／Vercel プレビュー環境のみ有効） |

---

## 4. フォーム通知の設定

フォームは `/api/contact`・`/api/partner`（サーバー側）で入力内容を検証し、メールで通知します。**送信設定が未完了の場合、フォームには「送信設定を準備中」と表示され、送信ボタンは押せません。** 成功画面はサーバーで送信に成功した場合のみ表示されます。

件名：
- 企業問い合わせ：`【企業問い合わせ】MIRATSUMU`
- 発信者登録：`【発信者登録申請】MIRATSUMU`

返信先（Reply-To）には送信者のメールアドレスが入るため、通知メールにそのまま返信できます。

### A. Resend を使う（推奨）
1. https://resend.com でアカウントを作成
2. 送信元にするドメイン（独自ドメイン）を追加し、DNS レコード（SPF / DKIM）を設定して認証
3. API キーを発行
4. 環境変数を設定：`MAIL_PROVIDER=resend` / `RESEND_API_KEY` / `MAIL_FROM="なまらグルメ <noreply@独自ドメイン>"` / `MAIL_TO=namaragurume@gmail.com`

### B. Formspree を使う（ドメイン未決定の間の暫定案）
1. https://formspree.io でフォームを作成し、通知先を `namaragurume@gmail.com` に設定（旧サイトのフォーム ID `xppqller` も使えます）
2. 環境変数を設定：`MAIL_PROVIDER=formspree` / `FORMSPREE_CONTACT_FORM_ID`
   - 発信者登録を別のフォームで受けたい場合のみ `FORMSPREE_PARTNER_FORM_ID` も設定（空なら同じフォームに届き、件名で区別）

### スパム対策
- ハニーポット（人には見えない入力欄）
- 表示から 3 秒未満の送信を破棄
- 同一 IP からの送信回数の制限（10 分あたり 5 回）
- 別サイトからの送信（Origin 不一致）の拒否
- Cloudflare Turnstile（環境変数を設定すると有効）

※レート制限はサーバーのメモリ上で行うため、Vercel ではインスタンスごとの制限になります。厳密に制限したい場合は Upstash Redis などに置き換えてください（`src/lib/spam.ts`）。

**公開前に必ず本番環境で両フォームの送信テストを行い、`namaragurume@gmail.com` に届くこと（迷惑メールフォルダも）を確認してください。**

---

## 5. 内容の変更方法

サイトの文章・数値はほぼすべて `src/data/` にあります。

| ファイル | 内容 |
|---|---|
| `brand.ts` | MIRATSUMU のブランドコンセプト・スローガン・ブランドストーリー・ロゴの意味 |
| `site.ts` | サイト名・会社情報・Instagram・トップの数値（14.2万人など）・メニュー |
| `images.ts` | サイト内の写真の差し替え（トップ最上部の背景写真 `heroMosaic` を含む） |
| `activities.ts` | これまでの活動（現場取材・イベント・企業との取り組み）と写真 |
| `services.ts` | サービス内容・対応 SNS |
| `reasons.ts` | 選ばれる5つの理由 |
| `creators.ts` | 掲載するインフルエンサー |
| `cases.ts` | PR実績 |
| `pricing.ts` | 料金・プラン・フォロワー規模別区分 |
| `faq.ts` | よくある質問 |
| `flow.ts` | ご利用の流れ |
| `history.ts` | 活動年表 |
| `privacy.ts` | プライバシーポリシーの確定状態・制定日 |

### 画像を変更する
1. 画像を `public/images/` 以下に置く（例：`public/images/food/hero.jpg`）
   - フォルダ：`brand/`（ロゴ）・`food/`・`creators/`・`works/`・`about/`
   - 推奨：横 2000px 程度までの JPG / WebP（自動で最適化されます）
2. `src/data/images.ts` の該当項目の `src` にパスを記入し、`alt` を実際の内容に合わせる

ロゴは `public/images/brand/` の `miratsumu-*.png`（`-white` は暗い背景用）。同じファイル名で上書きすれば差し替わります。ファビコンは `src/app/icon.png`。

`src` が空の項目は「仮素材」と表示されたプレースホルダーになります。

### インフルエンサーを追加する
`src/data/creators.ts` の `creators` 配列に追加します。

```ts
{
  id: "taro",                       // 半角英数字
  account: "taro_gourmet",          // @なし
  name: "たろう",                    // 任意
  image: "/images/creators/taro.jpg",
  platform: "Instagram",
  profileUrl: "https://www.instagram.com/taro_gourmet/",
  followers: 32000,
  followersAsOf: "2026年10月",
  genres: ["ラーメン", "居酒屋"],
  areas: ["札幌"],
  examples: [{ title: "〇〇の紹介リール", url: "https://www.instagram.com/reel/..." }],
  published: true,                  // 本人の掲載許可を得てから true
},
```

- **本人から名前・写真・投稿事例の掲載許可を得たものだけ `published: true` にしてください。**
- 掲載が 0 人の間は、一覧の代わりに「最適なグルメインフルエンサーをご提案します」という案内を表示します。
- 6 人以上になると、一覧ページにエリア・ジャンル・フォロワー規模の絞り込みが自動で表示されます（`src/components/sections/CreatorList.tsx` の `FILTER_THRESHOLD`）。
- カードの「この発信者を含めて相談する」を押すと、お問い合わせフォームの「希望インフルエンサー」に自動入力されます。

### 実績を追加・公開する
`src/data/cases.ts` に事例があります（現在 3 件、すべて `published: false`）。`【要確認】` の箇所を確認済みの事実に書き換え、以下がすべて揃ったら `published: true` にしてください。

- 実績値と集計期間・比較方法
- クライアントの公開許可（匿名掲載を含む）
- PR との関係（他の施策の有無）
- 画像・動画の掲載許可

公開した事例は `/works/[slug]` に詳細ページが自動で作られ、サイトマップにも追加されます。成果を PR だけの効果と断定する表現は避けてください。

### 料金を変更する
`src/data/pricing.ts` を編集します。`price` が空欄のプランは「個別見積もり」と表示されます。**確定していない金額は入力しないでください。** 税込・税別が決まったら `taxNote` に記入してください。

### 非公開コンテンツを確認する
`.env.local` に `CONTENT_PREVIEW=true` を設定して `npm run dev` すると、`published: false` の実績・発信者が「非公開プレビュー」の表示付きで確認できます。本番環境では無効です。

### フォロワー数の自動取得（Instagram Graph API）

トップの「Instagramフォロワー」と、発信者カードのフォロワー数を Instagram から自動取得できます（6時間ごとに更新。`src/lib/instagram.ts`）。設定しない場合は `src/data/` に入力した数値を表示します。

- 取得できるのは **プロアカウント（ビジネス／クリエイター）** のみです。個人アカウントの発信者は手入力の数値（`followers`）が表示されます。未入力なら非表示。
- Instagram の規約上、ページの読み取り（スクレイピング）は行わず、公式 API を使います。

設定手順（なまらグルメのアカウントで1回だけ行います）：

1. なまらグルメの Instagram をプロアカウントにし、Facebook ページと連携する
2. [Meta for Developers](https://developers.facebook.com/) でアプリを作成し、「Instagram Graph API（Facebook ログイン経由）」を追加
3. グラフAPIエクスプローラで `instagram_basic` と `pages_show_list`（必要に応じて `business_management`）の権限付きトークンを取得し、長期トークン（またはページのトークン）に交換
4. `GET /me/accounts?fields=instagram_business_account` で Instagram ビジネスアカウント ID を確認
5. Vercel の環境変数に `INSTAGRAM_BUSINESS_ACCOUNT_ID` と `INSTAGRAM_ACCESS_TOKEN` を設定して再デプロイ

※ 長期ユーザートークンの有効期限は約60日です。期限切れになると自動で手入力の数値に戻ります（表示は崩れません）。期限のないページトークンの利用を推奨します。

---

## 6. アクセス解析

`src/lib/analytics.ts` の `track()` で以下のイベントを送信します（計測タグが読み込まれている場合のみ）。

| イベント | タイミング |
|---|---|
| `generate_lead` | 企業問い合わせの送信成功（最重要 KPI） |
| `partner_apply` | 発信者登録申請の送信成功 |
| `cta_click` | CTA ボタンのクリック（`location` で設置場所を識別） |
| `instagram_click` | Instagram / DM への遷移 |

`NEXT_PUBLIC_GA_ID` を設定すると GA4 が読み込まれます。Cookie 同意バナーの要否・利用サービスは公開前に決定し、必要に応じて `src/components/layout/Analytics.tsx` を変更してください。

---

## 7. ディレクトリ構成

```text
src/
  app/                 各ページ（URL = フォルダ名）、API（api/contact, api/partner）、sitemap/robots/OGP
  components/
    layout/            Header / Footer / Analytics
    sections/          トップページの各セクション・共通セクション
    ui/                ボタン・カード・見出し・アコーディオンなどの部品
    forms/             お問い合わせ・登録フォーム
    animation/         スクロール表示・カウントアップ
  data/                サイトの内容（ここを編集）
  lib/                 入力検証・メール送信・スパム対策・計測
public/images/         画像
```

URL を変更する場合は `src/app/` のフォルダ名を変更し、`src/data/site.ts` のメニューと `src/app/sitemap.ts` を合わせて修正してください。

---

## 8. 未確定事項・公開前チェックリスト

### サイト内で仮の扱いにしている項目
- 写真（活動写真は設定済み。写っている方の掲載許可を確認）
- ブランドカラー（`src/app/globals.css` の `:root` で一括変更可）
- 実績 3 件（非公開）・掲載インフルエンサー（5 人。得意ジャンル・活動エリアは未入力）
- 料金（すべて「個別見積もり」、フォロワー規模別区分は参考表示）・税込/税別
- トップの数値の集計時点（`site.ts` の `stats.asOf`）
- 会社の設立年月日・代表者の正式表記・郵便番号（`site.ts`）
- プライバシーポリシー（確認用ドラフト。利用サービス名・保存期間など `【要確認】` 箇所あり）
- Instagram DM リンク（`https://ig.me/m/namaragurume`）の動作
- 発信者登録フォームのメールアドレス必須化（連絡手段として必須にしています。運用方針を確認）

### ブランド
- [x] 正式なサービス名称が確定している（MIRATSUMU）
- [x] 正式ロゴを配置（`public/images/brand/`）
- [ ] ブランドカラーを確認
- [ ] Instagram リンク・DM リンクの確認
- [ ] 独自ドメインの決定（`NEXT_PUBLIC_SITE_URL` を更新）
- [ ] 会社概要の正式情報を確認

### 料金
- [ ] 5万円〜の適用条件を確認
- [ ] 各プランの提供範囲を確認
- [ ] フォロワー規模別の料金設定を確認
- [ ] 税込・税別の表記を決定
- [ ] 二次利用など追加料金条件を確認

### 実績
- [ ] 売上200万円→600万円の対象期間を確認
- [ ] 2,000フォロワー達成までの期間を確認
- [ ] 食べログ200%UPの定義（前月比200%／200%増）を確認
- [ ] 施策内容を確認
- [ ] 匿名で掲載することの許可を確認
- [ ] 投稿画像・動画の掲載許可を確認
- [ ] 実績に関する誤認を招く表現がないか確認

### 発信者
- [ ] 掲載者本人から許可を取得
- [ ] 写真の掲載権限を確認
- [ ] フォロワー数・活動エリアを更新
- [ ] 投稿事例の利用許可を確認
- [ ] パートナー登録時の連絡先入力方法を確定
- [ ] 審査と登録に関する案内文を確認

### フォーム
- [ ] 企業お問い合わせの送信テスト（本番環境）
- [ ] パートナー登録の送信テスト（本番環境）
- [ ] namaragurume@gmail.com への通知受信を確認
- [ ] 送信失敗時の表示を確認
- [ ] スパム対策を確認（Turnstile の導入を推奨）
- [ ] 必須項目・入力エラーを確認
- [ ] 個人情報の取扱いへの同意機能を確認

### デザイン・技術
- [ ] PC / スマートフォンで表示確認
- [ ] 全リンクの動作確認
- [ ] アニメーション確認
- [ ] 画像の読み込み確認
- [ ] SEO メタデータ確認
- [ ] サイトマップ生成確認（`/sitemap.xml`）
- [ ] 本番ビルド成功（`npm run build`）
- [ ] Lighthouse でパフォーマンス確認
- [ ] アクセシビリティの基本確認
- [ ] プライバシーポリシーを確定し `src/data/privacy.ts` の `finalized` を `true` に
