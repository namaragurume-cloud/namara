# TABETUNAGU（食べつなぐ）

> 捨てられるはずだった、おいしさを。次の人へ。 — 食のバトンをつなぐ。

まだおいしく食べられるパン・お弁当・お惣菜・スイーツなどを、作ったお店から次に食べる人へ「つなぐ」サービスの MVP です。
入口は「近くのおいしいものを、お得に楽しめる」こと。結果として食品ロスが減る体験をつくります。

- **商品代金は TABETUNAGU で決済しません。** ユーザーはお店のいつものレジ（現金・カード・QR 決済など）で支払います。
- TABETUNAGU が管理するのは **予約 → 来店確認（店舗 QR チェックイン）→ 成約記録** だけです。
- 成約は **ユーザーが店頭の QR を読み取ること** で記録します（店舗の「完了ボタン」に依存しない＝成約漏れを防ぐ）。

PoC 想定：札幌市中心部（札幌駅・大通・すすきの）、30 店舗、ユーザー 500〜1,000 人、約 3 か月。

---

## 1. 実装した機能

### ユーザー（スマホ・LINE / Web）
| 画面 | パス | 内容 |
|---|---|---|
| ホーム | `/` | 受付中の件数、エリア別件数、カテゴリー、今日のおすすめ、まもなく受取終了、しくみ |
| 商品一覧 | `/products` | エリア・カテゴリー・受取時間で絞り込み／おすすめ・近い（エリア距離）・終了時間順・価格で並べ替え |
| 商品詳細 | `/products/[id]` | 写真・店舗・説明・通常価格（小さく）・食べつなぎ価格・残数・受取時間・店舗情報・「食べつなぐ」 |
| 予約確認 | `/products/[id]/reserve` | 商品・店舗・価格・数量・受取時間・注意事項 →「予約を確定する」 |
| 予約完了 / 詳細 | `/reservations/[id]` | 店舗名・受取時間・予約番号・「店舗に着いたらQRを読み取ってください」・キャンセル |
| 予約一覧 | `/reservations` | 今後の予約 / 過去の食べつなぎ / キャンセル |
| QR チェックイン | `/checkin` | LIFF の `scanCodeV2`、ブラウザのカメラ（BarcodeDetector / jsQR） |
| 店頭 QR | `/c/[token]` | QR の署名検証 → 対象予約の確認 →「受け取りを確定する」 |
| 食べつなぎ完了 | `/done/[id]` | 「食べつなぎ完了！」・獲得ポイント・累計回数・推定食品ロス削減量・支払額と予約番号 |
| マイページ | `/me` | 名前・回数・ポイント・履歴・お気に入り店舗・通知設定（まとめ通知の ON/OFF・エリア） |
| 店舗ページ | `/stores/[slug]` | 店舗情報・今日の出品・お気に入り |

### 店舗（PC / スマホ）
| 画面 | パス | 内容 |
|---|---|---|
| ダッシュボード | `/store` | **いつものBOXをワンタップ出品**・**前回と同じ内容で出品**・本日の出品／予約数／残数／完了数／キャンセル・今月の GMV / QR 完了率 / 手数料 |
| 出品 | `/store/products/new` | BOX / 単品・商品名・数量・価格・受取時間・写真（端末で自動縮小）・**AI 文章生成**・**AI 値引き提案（STANDARD）**・テンプレート保存 |
| 出品商品 | `/store/products` | 受付停止 / 再開・再出品・数量 / 価格 / 説明の変更・削除 |
| 予約状況 | `/store/reservations` | 日別の予約（予約番号・表示名はマスク）・店舗都合キャンセル（理由必須）。**完了ボタンはなし** |
| 売上・手数料 | `/store/sales` | 月別の成約売上・手数料内訳・日別グラフ。STANDARD は時間帯別・商品別分析 |
| QR コード | `/store/qr` | 印刷用の店舗 QR・再発行（古い QR は無効化） |
| 店舗設定・プラン | `/store/settings` | FREE / STANDARD の比較と変更（オーナーのみ）・テンプレートと自動再出品・店舗情報・メンバー・請求 |

### 管理者
| 画面 | パス | 内容 |
|---|---|---|
| KPI | `/admin` | 登録店舗・稼働店舗・稼働率・登録ユーザー・MAU・出品数・予約数・成約数・食べつなぎ率・QR 完了率・No Show 率・30 日リピート率・GMV・手数料売上・月額売上・FREE / STANDARD 店舗数・直近 14 日の推移・**QR 完了率が極端に低い店舗**・運用ボタン |
| 店舗 | `/admin/stores`, `/admin/stores/[id]` | 店舗ごとの予約→QR 完了率・No Show・店舗都合キャンセル・QR 失敗数・判定（要確認 / 注意）。ステータス・プラン変更、メンバー追加、店舗追加 |
| ユーザー / 商品 / 予約・成約 | `/admin/users` ほか | 一覧。予約は 成約一覧・来店待ち・No Show・キャンセル・期限切れ で切替 |
| 通知 | `/admin/notifications` | 「今夜のTABETUNAGU」まとめ通知のプレビュー・対象者生成・送信（未設定時は dry run） |
| 請求 | `/admin/billing` | 月次の請求データ（月額 + 成約手数料）の作成 |

### 仕組み
- **在庫の原子的な減算**（最後の 1 個の同時予約でも 1 人だけ成功）・重複予約防止・同時保有 3 件まで
- **QR チェックイン**：HMAC 署名トークン（`store_id` + `qr_version`）、ログイン・有効な予約・受取時間（開始 30 分前〜終了 30 分後）・完了済み・キャンセル済み・停止店舗を検証。失敗も記録
- **No Show 管理**：受取終了 + 30 分を過ぎた `confirmed` → `no_show`、`pending` → `expired`（Cron / 管理画面から実行）
- **信頼スコア**（DB のみ）：100 点スタート、No Show −20、受取開始後のキャンセル −5、完了 +2
- **手数料**：FREE = 成約売上 × 15%、STANDARD = 4,980 円 + 成約売上 × 5%。成約時点のプランと手数料率を予約に記録（月の途中のプラン変更にも対応）
- **AI 販売文章生成**：OpenAI（未設定・エラー・上限超過時はテンプレート）。禁止語（レスキュー・救う・半額 など）を含む出力は破棄
- **AI 値引き提案**：直近の販売履歴によるルールベース（STANDARD）
- **自動再出品**：STANDARD のテンプレートを曜日指定で毎朝出品
- **まとめ通知**：1 人 1 日 1 通、通知エリア・お気に入り店舗（STANDARD）に合わせて文面を作り、同じ文面ごとに LINE multicast
- **分析イベント**：`product_view` / `reservation_created` / `reservation_cancelled` / `qr_checkin` / `reservation_completed` / `no_show` / `favorite_store` / `ai_description_generated` ほか（`events` テーブル）
- **将来の AI 用の販売履歴**：`product_sales_history`（曜日・時間・価格・割引率・出品数・予約数・完了数・No Show・完売時刻・`external_features`）を予約の状態変化ごとにトリガーで更新。天気などは `external_daily_features` に後から取り込める

---

## 2. 技術構成

| 項目 | 採用 |
|---|---|
| Frontend / Fullstack | Next.js 16（App Router, Server Components, Server Actions）/ React 19 / TypeScript |
| UI | Tailwind CSS v4 / lucide-react（依存を増やさないため shadcn/ui は不使用） |
| DB | PostgreSQL（**Supabase**）。ローカルと自動テストは組み込み PostgreSQL（PGlite, WASM） |
| DB アクセス | `postgres`（postgres.js）+ SQL。整合性が必要な処理は PostgreSQL 関数 |
| 認可 | **RLS**（Supabase と同じ `anon` / `authenticated` ロール + `auth.uid()`）+ サーバー側のチェック |
| Auth | LINE Login（LIFF の ID トークン / Web の OAuth）→ 署名付き JWT の httpOnly Cookie。開発用デモログイン |
| AI | OpenAI Responses API（`OPENAI_MODEL`） |
| Validation | Zod |
| Test | Vitest（DB 込みのユニットテスト）/ Playwright（E2E） |
| Hosting | Vercel（Cron 含む） |

既存リポジトリ（MIRATSUMU サイト）と同じ Next.js / React / Tailwind / Zod のバージョンに揃え、独立したアプリとして `tabetunagu/` に置いています。

### 設計上の判断
- **Supabase Auth ではなく LINE Login + 自前セッション**：LINE は Supabase Auth の標準プロバイダーではないため、LINE の ID トークンをサーバーで検証してセッションを発行します。DB 接続時には Supabase の PostgREST と同じく `role=authenticated` と `request.jwt.claims.sub` をトランザクションに設定するので、**RLS はそのまま効きます**（`src/server/db/index.ts`）。
- **ブラウザから Supabase に直接アクセスしない**：すべてサーバー経由。Service Role Key はクライアントに渡りません。Supabase の Data API（PostgREST）は無効化を推奨（§5）。
- **ローカルは DB 不要で起動**：`DATABASE_URL` 未設定時は PGlite を自動で起動し、マイグレーションとデモデータを投入します。同じ SQL（RLS・関数）がそのまま動きます。
- **React Hook Form は不使用**：Server Actions + `useActionState` + Zod（サーバー側検証）で、クライアントの JS を最小限にしています。

---

## 3. ディレクトリ構造

```
tabetunagu/
├─ supabase/
│  ├─ migrations/20261017000000_init.sql   # スキーマ・RLS・権限・DB 関数（Supabase CLI 互換の配置）
│  └─ local/bootstrap.sql                  # ローカル専用: anon/authenticated ロールと auth.uid()
├─ scripts/migrate.ts, seed.ts             # npm run db:migrate / db:seed
├─ src/
│  ├─ app/
│  │  ├─ (user)/…                          # ユーザー画面（ホーム・一覧・詳細・予約・QR・完了・マイページ）
│  │  ├─ store/…                           # 店舗管理画面
│  │  ├─ admin/…                           # 管理者画面
│  │  ├─ login/                            # LINE ログイン / デモログイン
│  │  ├─ actions/{user,store,admin,auth}.ts# Server Actions（入力検証・認可）
│  │  └─ api/{auth,cron,uploads}/…         # LINE 認証・Cron・ローカル画像配信
│  ├─ components/                          # UI（product / store / admin / checkin / liff / ui）
│  ├─ lib/                                 # 共有ロジック（手数料・文言・AI テンプレート・値引き提案・検証・日時）
│  └─ server/
│     ├─ db/                               # ドライバ（postgres.js / PGlite）・RLS 付きトランザクション・マイグレーション・デモデータ
│     ├─ auth/                             # セッション・LINE・権限ガード
│     ├─ services/                         # catalog / reservations / checkin / store / admin / ai / notifications / uploads / events
│     ├─ qr.ts                             # 店舗 QR トークンの署名・検証
│     └─ env.ts                            # 環境変数（サーバー専用）
├─ tests/                                  # Vitest（予約・QR・RLS・手数料・AI・文言）
└─ e2e/                                    # Playwright（コアフロー・権限）
```

---

## 4. DB 構造

| テーブル | 内容 |
|---|---|
| `users` | LINE User ID・表示名・（任意）メール・通知設定 |
| `user_stats` | 予約数・完了数・キャンセル数・直前キャンセル数・No Show 数・ポイント残高・`trust_score` |
| `admin_users` | 管理者 |
| `stores` | 店舗（エリア・カテゴリー・状態 `pending/active/suspended`・プラン・`qr_version`） |
| `store_members` | 店舗とユーザーの紐付け（`owner` / `staff`） |
| `store_plan_changes` | プラン変更履歴 |
| `plans` | FREE / STANDARD（月額・手数料率・機能） |
| `areas` | 札幌駅 / 大通 / すすきの / その他 |
| `product_templates` | いつもの出品・自動再出品（曜日） |
| `products` | 出品（`original_price`・`rescue_price`＝食べつなぎ価格・`quantity`・`remaining_quantity`・受取時間・状態・推定重量） |
| `reservations` | 予約（予約番号・数量・価格スナップショット・受取時間スナップショット・状態・各時刻・成約時のプランと手数料率） |
| `checkins` | QR チェックインの試行ログ（成功・失敗の理由） |
| `favorites` | お気に入り店舗 |
| `points_transactions` | ポイント（予約ごとに 1 回だけ付与） |
| `notifications` / `notification_deliveries` | まとめ通知と配信結果 |
| `ai_generations` | AI 生成ログ（入力・出力・プロバイダー・所要時間） |
| `billing_records` | 月次請求（月額・成約額・手数料・請求額） |
| `events` | 分析イベント |
| `product_sales_history` | 出品ごとの販売結果（将来の需要予測・値引き提案・仕込み量提案用） |
| `external_daily_features` | エリア × 日付の外部特徴量（天気など） |

予約ステータス：`pending`（確定待ち。現状は即時確定のため将来の店舗承認制用）/ `confirmed` / `completed` / `cancelled` / `no_show` / `expired`

主な DB 関数（`SECURITY DEFINER`。内部で `auth.uid()` と所属を検証）：
`reserve_product` / `cancel_reservation` / `store_cancel_reservation` / `checkin_store` / `adjust_product_quantity` / `delete_product` / `rotate_store_qr` / `change_store_plan` / `sweep_reservations`（service のみ）/ `auto_relist_templates`（service のみ）

---

## 5. セットアップ

必要なもの：Node.js 20.9 以上（推奨 22）。ローカルでは DB・LINE・OpenAI の設定は不要です。

```bash
cd tabetunagu
npm install
npm run dev            # http://localhost:3000
```

初回アクセス時に `.data/pglite` に組み込み DB が作られ、マイグレーションと札幌の架空店舗のデモデータが入ります（10 秒ほど）。
日付が変わってデモの出品がなくなった場合は、起動時に今日の出品が自動で作り直されます（管理画面の「デモの出品を今日の日付で作り直す」でも可）。
DB を初期化したいときは `.data/` を削除してください。

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm run start` | 本番ビルド / 起動 |
| `npm run lint` / `npm run typecheck` | ESLint / 型チェック |
| `npm test` | ユニットテスト（Vitest, PGlite） |
| `npm run test:e2e` | E2E（Playwright。開発サーバーを自動起動） |
| `npm run db:migrate` | マイグレーション適用（`DATABASE_URL` があればそちら） |
| `npm run db:seed` | デモデータ投入（本番では拒否） |

---

## 6. 必要な環境変数

一覧と説明は [`.env.example`](./.env.example) にあります。本番で必須なのは次のとおりです。

| 変数 | 必須 | 内容 |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | ○ | 公開 URL（LINE のコールバック・QR の URL） |
| `APP_ENV` | ○ | `production`（デモログインを無効化し、秘密鍵の設定を強制） |
| `DATABASE_URL` | ○ | Supabase の接続文字列（Transaction pooler 推奨） |
| `AUTH_SECRET` | ○ | セッション署名鍵（32 文字以上） |
| `QR_SIGNING_SECRET` | ○ | 店舗 QR の署名鍵（32 文字以上。変えると印刷済み QR が無効） |
| `CRON_SECRET` | ○ | Vercel Cron の認証 |
| `NEXT_PUBLIC_LIFF_ID` / `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` | ○ | LIFF・LINE Login |
| `LINE_CHANNEL_ACCESS_TOKEN` | 任意 | まとめ通知の送信（未設定なら dry run） |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 任意 | 商品写真の保存（未設定だと本番では写真なしで出品） |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | 任意 | AI 文章生成（未設定ならテンプレート） |

秘密情報は `.env.local` または Vercel の環境変数にのみ保存し、Git にコミットしないでください。

---

## 7. DB migration

```bash
# Supabase（または任意の PostgreSQL）に適用
DATABASE_URL="postgresql://postgres.xxxx:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres" npm run db:migrate

# Supabase 以外の素の PostgreSQL では、ロールと auth スキーマも作る
DATABASE_URL=... npm run db:migrate -- --bootstrap
```

- 適用済みのバージョンは `public.schema_migrations` に記録されます（再実行しても二重適用されません）。
- `supabase/migrations/` は Supabase CLI と同じ配置なので `supabase db push` でも適用できます（その場合は `schema_migrations` を使う本スクリプトとどちらか一方に統一してください）。
- **追加のマイグレーションでテーブル・関数を作るときは、最小権限の `grant` を明示してください**（初期マイグレーションの末尾で `anon` / `authenticated` からいったん全権限を剥奪し、必要なものだけ付与しています）。

---

## 8. Supabase 設定

1. プロジェクトを作成（リージョン：Tokyo `ap-northeast-1`）
2. **Database → Connection string → Transaction pooler（:6543）** を `DATABASE_URL` に設定し、`npm run db:migrate`
3. **Storage** でバケット `product-images` を作成（Public・画像のみ・5MB 上限）。`NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` を設定
4. **Data API（PostgREST）**：アプリはブラウザから Supabase を直接呼ばないため、**Settings → API で Data API を無効化**（または Exposed schemas から `public` を外す）することを推奨します。有効のままでも、`anon` は公開中の商品・稼働店舗・エリア・プランを読めるだけです（予約・ユーザー・イベントは RLS と権限で拒否）。
5. 管理者の登録：管理者にしたい人が一度 LINE でログインしたあと、SQL Editor で
   ```sql
   insert into public.admin_users (user_id) select id from public.users where display_name = '（表示名）';
   ```
6. 店舗の登録：管理画面「店舗」で店舗を追加 → 店舗の方に LINE でログインしてもらう → 店舗詳細でユーザー ID をメンバー（オーナー / スタッフ）に追加 → ステータスを「稼働中」に
7. バックアップ（PITR）の有効化を推奨

> アプリは接続ユーザー（`postgres`）からトランザクションごとに `authenticated` / `anon` ロールへ切り替えます（SQL Editor で RLS を確認するときと同じ方法）。もし `permission denied to set role` になる場合は、SQL Editor で `grant anon, authenticated to postgres;` を実行してください。

---

## 9. LINE Developers 設定

同じ **プロバイダー** の下に次の 2 チャネルを作成します（プロバイダーが同じなら LINE の User ID が共通になり、ログインしたユーザーに通知を送れます）。

### LINE Login チャネル（ログイン・LIFF）
- コールバック URL：`https://<ドメイン>/api/auth/line/callback`
- スコープ：`openid` `profile`（メールアドレスは取得しない）
- **Channel ID → `LINE_CHANNEL_ID`、Channel secret → `LINE_CHANNEL_SECRET`**
- 「リンクされた LINE 公式アカウント」に下記 Messaging API の公式アカウントを設定し、友だち追加オプションを有効にすると、ログイン時に友だち追加を促せます

### Messaging API チャネル（まとめ通知）
- 長期のチャネルアクセストークンを発行して **`LINE_CHANNEL_ACCESS_TOKEN`** に設定
- 通知は公式アカウントを友だち追加しているユーザーにのみ届きます
- 送信数は LINE 公式アカウントの料金プランのメッセージ数にカウントされます（まとめ通知は 1 人 1 日 1 通まで）

## 10. LIFF 設定

1. LINE Login チャネル → **LIFF** → 追加
   - サイズ：Full
   - エンドポイント URL：`https://<ドメイン>/`
   - Scope：`openid` `profile`
   - 「Scan QR」：ON（`liff.scanCodeV2` を使うため）
2. 発行された LIFF ID を **`NEXT_PUBLIC_LIFF_ID`** に設定
3. 動作
   - LINE アプリ内で開くと自動でログインします（ID トークンを `/api/auth/liff` でサーバー検証）
   - `NEXT_PUBLIC_LIFF_ID` があると、店舗 QR の URL は `https://liff.line.me/<LIFF ID>/c/<token>` になり、スマホのカメラで読み取っても LINE で開きます
   - 通常のブラウザでも同じアプリがそのまま動きます（LINE Login の Web フローでログイン）
4. LINE ミニアプリとして公開する場合は、LINE Developers の「LINE ミニアプリ」チャネルでの申請・審査が必要です（§17）

## 11. OpenAI API 設定

- `OPENAI_API_KEY` と `OPENAI_MODEL`（既定 `gpt-5-mini`）を設定
- 1 店舗 1 日あたりの OpenAI 生成回数：FREE 5 回 / STANDARD 50 回（`src/server/services/ai.ts`）。超過・未設定・エラー・タイムアウト（12 秒）・トーン違反の出力のときはテンプレート生成に切り替わります
- プロンプトはサービスのトーン（煽らない・SDGs を押し付けない・「おいしい」「お得」「次につなぐ」）に合わせています

---

## 12. ローカル開発

- DB：未設定なら PGlite（`.data/pglite`）。本物の PostgreSQL で確認する場合は `DATABASE_URL` を設定して `npm run db:migrate -- --bootstrap && npm run db:seed`
- 写真：Supabase 未設定時は `.data/uploads` に保存し `/api/uploads/...` で配信
- LINE：未設定なら LINE ログインは「準備中」と表示され、デモログインで確認できます
- QR の確認：店舗オーナーでログイン →「QR コード」画面の URL（印刷物と同じもの）をユーザーのブラウザで開くと、QR を読み取ったのと同じ動きになります

## 13. デプロイ（Vercel）

1. Vercel で新規プロジェクトを作成し、このリポジトリを選択。**Root Directory を `tabetunagu`** に設定（MIRATSUMU サイトとは別プロジェクト）
2. リージョン：`hnd1`（Tokyo）。Supabase と同じリージョンに
3. 環境変数（§6）を設定。Production には `APP_ENV=production`
4. デプロイ
5. **Cron**（`vercel.json`）
   | パス | スケジュール（UTC） | 内容 |
   |---|---|---|
   | `/api/cron/daily` | 22:00（JST 7:00） | No Show 判定 + 自動再出品 |
   | `/api/cron/digest` | 9:00（JST 18:00） | 今夜のTABETUNAGU まとめ通知 |
   | `/api/cron/sweep` | 15:00（JST 0:00） | No Show / 期限切れ判定 |

   Hobby プランの Cron は 1 日 1 回までです。No Show 判定をこまめに行うなら Pro で `sweep` を毎時にしてください（KPI の QR 完了率は、未判定の予約も受取終了 + 30 分を過ぎていれば分母に含めて計算するため、判定が遅れても数字はずれません）。
6. プレビュー環境でデモログインを使う場合は `ENABLE_DEMO_LOGIN=true` と別の DB を使ってください

## 14. テスト

```bash
npm test             # ユニット（56 件）
npm run test:e2e     # E2E（4 件）
# 起動済みのサーバー（例: next start + DATABASE_URL）に対して E2E
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

| 観点 | テスト |
|---|---|
| 予約作成・数量減少 | `tests/reservations.test.ts` |
| 売り切れ防止・同時に最後の 1 個 | 同上（実 PostgreSQL でも 30 並列で 1 件のみ成功を確認済み） |
| キャンセル（在庫の戻り・二重キャンセル・他人の予約） | 同上 |
| 停止店舗・数量 0・削除済み・受取終了・受付停止の商品 | 同上 |
| No Show 判定・信頼スコア | 同上 |
| QR チェックイン・二重チェックイン・同時チェックイン | `tests/checkin.test.ts` |
| 他店舗の QR・改ざん QR・再発行後の古い QR・受取時間外・キャンセル後・停止店舗 | 同上 |
| 権限（店舗 A のスタッフが店舗 B にアクセス・列権限・anon・管理者テーブル） | `tests/authorization.test.ts` |
| FREE / STANDARD 手数料・プラン変更月・端数 | `tests/fees.test.ts` |
| AI 文章（テンプレート・禁止語）・値引き提案 | `tests/ai-copy.test.ts` |
| UI に「レスキュー」「救う」「半額」を使っていない | `tests/copy-guard.test.ts` |
| 出品 → 予約 → 店舗 QR → 完了、権限、改ざん QR | `e2e/core-flow.spec.ts` |

## 15. デモアカウント

開発環境（`APP_ENV` が production 以外で、`next dev` または `ENABLE_DEMO_LOGIN=true`）のとき、`/login` にデモログインが表示されます。

| アカウント | できること |
|---|---|
| ユーザー | 商品の予約・QR チェックイン・履歴（過去 40 日分の利用履歴あり） |
| 店舗オーナー | 大通ベーカリー（STANDARD）：出品・テンプレート・売上・プラン変更・QR 再発行 |
| 店舗スタッフ | すすきのデリ（FREE）：出品・予約確認（プラン変更・店舗情報の変更は不可） |
| 管理者 | KPI・店舗・ユーザー・予約・通知・請求 |

デモデータの店舗・ユーザーはすべて架空です（実在の店舗名は使用していません）。「すすきの夜食堂」は QR 完了率が低い店舗の例として作っています。

---

## 16. 未実装・今後の優先順位

### 未実装（MVP の範囲外にしたもの）
- 店舗オーナーによるスタッフ招待（現在は管理者がメンバーを追加）
- 予約リマインド通知・お気に入り店舗の個別即時通知（まとめ通知に統合）
- ポイントの交換・失効、信頼スコアによる予約制限（DB は対応済み）
- 位置情報による「近い順」（現在はエリアの距離で近似）
- 店舗の承認制予約（`pending` は定義済み）
- 請求書の発行・入金管理（請求データの作成まで）
- 本格的な需要予測・完売予測（履歴データの蓄積まで）
- 退会・データ削除の画面、利用規約・プライバシーポリシーのページ

### 次に実装すべき優先順位
1. 利用規約・プライバシーポリシー・特定商取引法の表記（店舗との契約条件含む）、退会
2. LINE 実機での QR 読み取り・ログインの検証（iOS / Android、LIFF / 外部ブラウザ）
3. 予約リマインド（受取開始 30 分前、LINE）と、No Show が続くユーザーへの予約制限
4. 店舗オーナーによるスタッフ招待（招待コード）
5. エラー監視（Sentry 等）とレート制限（予約・チェックイン・AI）
6. 請求書 PDF・入金ステータス管理
7. 需要予測・出品時間提案（`product_sales_history` + 天気）

## 17. LINE ミニアプリ公開までに必要な残作業
1. LINE Developers で LINE ミニアプリチャネルを作成（未認証ミニアプリとして開始 → 認証申請）
2. 本番ドメイン・HTTPS、エンドポイント URL の登録
3. 利用規約・プライバシーポリシーの URL 登録、サービスの審査対応（決済をアプリ内で行わない旨の説明）
4. LINE 公式アカウントとの連携（友だち追加導線・リッチメニューに「さがす」「QR」「予約」）
5. iOS / Android の LINE 内ブラウザでの実機テスト（カメラ権限・`scanCodeV2`・Cookie）
6. まとめ通知の配信数とメッセージ料金の見積もり
7. 店舗向けの QR 掲示物・オペレーション手順書（「QR を読み取ってからお会計」）

---

## 18. セキュリティ上の注意点
- **秘密情報**：`SUPABASE_SERVICE_ROLE_KEY` / `AUTH_SECRET` / `QR_SIGNING_SECRET` / `LINE_*` / `OPENAI_API_KEY` / `CRON_SECRET` はサーバー専用（`src/server/env.ts` 以外から参照しない）。`NEXT_PUBLIC_` を付けない
- **認可はサーバー側で二重に**：Server Action / ページで所属・権限を確認 + DB の RLS（店舗 A のスタッフは店舗 B のデータを読み書きできない）。管理画面は管理者以外には 404
- **在庫・成約は DB 関数のみが更新**：店舗スタッフは在庫・状態を直接書き換えられない（列権限 + トリガー）。店舗による完了操作はなく、成約は QR チェックインのみ
- **QR**：HMAC 署名で偽造・他店舗への書き換えを防止。コピーされた疑いがあれば再発行で旧 QR を無効化。印刷物の QR は静的なので、離れた場所からのチェックインは受取時間の制限で抑止（必要なら店頭タブレットでのローテーション QR に拡張）
- **CSRF**：Server Actions の Origin チェック、LIFF ログイン API の Origin チェック、LINE OAuth の state / nonce
- **オープンリダイレクト防止**：ログイン後の戻り先は自サイト内パスのみ
- **個人情報の最小化**：LINE の User ID と表示名のみ取得（メールは取得しない）。店舗には表示名の一部のみ表示。位置情報は使わない
- **デモログイン**：`APP_ENV=production` では常に無効。本番 DB にデモデータを入れない（`db:seed` は本番で拒否）
- **画像アップロード**：形式（マジックバイト）とサイズを検証し、ランダムなファイル名で保存
- **Cookie**：httpOnly / SameSite=Lax / 本番は Secure
