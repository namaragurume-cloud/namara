# 外部API連携の準備（API_INTEGRATIONS）

> **すべて未接続です。** どの接続も、費用・利用資格・規約を確認し、オーナーの承認を得てから行います。
> 下の「公式情報」は 2026-10-22 時点で確認できた範囲です。接続前に必ず最新の公式ドキュメントを再確認してください。

## 1. Supabase（Phase 2）

| 項目 | 内容 |
| --- | --- |
| 用途 | PostgreSQL・認証（店舗ユーザー・運営）・RLS・Vault（外部トークン保管）・pg_cron（保存期間の削除） |
| オーナーにお願いしたいこと | Supabase アカウント作成、プロジェクト作成（**リージョンは東京を推奨**）、料金プランの決定（無料枠で開始可能か確認） |
| 必要な値 | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` |
| 注意 | service_role キーはサーバー専用。Vercel の環境変数にだけ登録し、チャット等に貼らない |

## 2. LINE Messaging API（Phase 7）

| 項目 | 内容 |
| --- | --- |
| 用途 | なまらAI（消費者向け）の検索。店舗通知は **別チャネル** |
| 実装済み | 生ボディでの署名検証（`X-Line-Signature`、HMAC-SHA256）、`webhookEventId` による重複排除、Flex Message 生成、ユーザー単位のレート制限、`after()` による応答後処理 |
| 公式情報（確認済み） | 再送された Webhook は `deliveryContext.isRedelivery` 以外は同じ内容で、webhookEventId・replyToken も同じ。重複受信がありうるため webhookEventId で判定することが推奨されている |
| 要確認 | 返信トークンの有効期限・使用条件（公式ページを直接取得できなかったため未確認）。期限を超える場合は Push API（**通数課金**）またはキューでの対応が必要 |
| オーナーにお願いしたいこと | 既存の「なまらグルメ公式LINE」を使うか新設するかの決定、LINE Developers でのチャネル作成、料金プラン（無料メッセージ通数）の確認 |
| 必要な値 | `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN`、公開 HTTPS の Webhook URL（Vercel デプロイ後） |

## 3. OpenAI API（Phase 3 後半〜）

| 項目 | 内容 |
| --- | --- |
| 用途 | 検索文から条件を抽出（JSON）。AI店長の提案文の言い回し。**店舗名・価格・営業時間は生成させない** |
| 設計 | 出力は Zod で検証し `normalizeConditions()` を通す。失敗・タイムアウト時は辞書解析にフォールバック。入力文の最大長200文字 |
| 費用 | 検索1回ごとに従量課金。モデルと単価は接続時に公式の料金表で確認し、月の上限額を設定する |
| オーナーにお願いしたいこと | OpenAI の組織アカウント・支払い設定・利用上限額の決定。データ利用（学習への利用有無）の設定確認 |
| 代替案 | 他社の LLM API も同じインターフェースで差し替え可能（`ParseResult.parser` で区別） |

## 4. Google Business Profile API（Phase 8）

| 項目 | 内容 |
| --- | --- |
| 用途 | 正式に管理権限がある店舗の口コミ取得と返信投稿 |
| 公式情報（確認済み） | 利用には Google Cloud プロジェクトと、GBP API の利用申請フォームでの **アクセス申請・承認** が必要。申請はビジネスプロフィールのオーナー/管理者として登録されたメールで行う。返信は `accounts.locations.reviews/updateReply`（`business.manage` スコープ、確認済みの店舗のみ） |
| 未確認 | 承認に必要な期間・追加条件（第三者の情報では「60日以上の運用実績」などがあるが、公式では未確認） |
| 実装方針 | 承認されるまでモック。AI返信案 → 人が編集 → 承認 → `reply_publications`（idempotency_key で二重投稿防止）→ 投稿 |
| オーナーにお願いしたいこと | なまらグルメとしての Google Cloud プロジェクト作成、API 利用申請、OAuth 同意画面の設定 |

## 5. Google Places API（採用は保留）

| 項目 | 内容 |
| --- | --- |
| 検討理由 | 店舗の写真・営業時間・地図リンクの取得 |
| 公式ポリシー（確認済み） | Place ID 以外のコンテンツのキャッシュ・保存は原則禁止。Google マップ以外の地図と一緒に表示しない、Google ロゴと帰属表示が必要、写真・口コミは作者の帰属表示が必要、利用規約・プライバシーポリシーで Google の規約に触れる必要がある |
| 判断 | 「自前の店舗マスターに保存して推薦する」という本サービスの設計とキャッシュ制限が合わないため、**現時点では採用しない**。地図リンクは Google マップの検索URL（API不要）で代替。写真は店舗提供・なまらグルメ撮影のもの（出典表記つき）を使う |

## 参考（今回確認した情報源）
- LINE Developers「Receive messages (webhook)」 https://developers.line.biz/en/docs/messaging-api/receiving-messages/
- Google Business Profile API 前提条件 https://developers.google.com/my-business/content/prereqs
- reviews.updateReply https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/updateReply
- Places API ポリシー https://developers.google.com/maps/documentation/places/web-service/policies
