# NAMARA REVIEW 技術構成

## 全体像

```
[店舗担当者のブラウザ / スマホ]        [LINE アプリ]
          │                                │ 通知・承認ページへのリンク
          ▼                                ▼
┌──────────── Next.js（Vercel）─────────────┐
│ 画面（App Router / React Server Components）│
│ Route Handlers / Server Actions            │
│  ├ 認証チェック（Supabase Auth）            │
│  ├ 権限チェック（permissions.ts と同じ表）   │
│  ├ Google Business Profile 連携（同期・投稿）│
│  ├ OpenAI 連携（返信案・月次分析）           │
│  └ LINE Webhook（署名検証）・通知送信        │
│ 定期実行（Vercel Cron → 同期API）           │
└───────────────┬───────────────────────────┘
                ▼
     Supabase（PostgreSQL + Auth + RLS）
```

- 外部APIの鍵・トークンはすべてサーバー側でのみ扱う。ブラウザには Supabase の公開キー（publishable key）だけを渡す。
- 外部サービスへの書き込み（Google への返信投稿・LINE 送信）はサーバーで行い、冪等キーと処理履歴テーブルで二重実行を防ぐ。

## 採用技術

| 分野 | 採用 | 備考 |
| --- | --- | --- |
| フレームワーク | Next.js 16（App Router, Turbopack, Cache Components） | `create-next-app` の推奨設定 |
| 言語 | TypeScript（strict） | |
| スタイル | Tailwind CSS v4 | トークンは `src/app/globals.css` |
| UI部品 | shadcn/ui 形式（Radix UI + class-variance-authority + tailwind-merge） | `components.json` あり。開発環境から ui.shadcn.com に接続できなかったため、同じ形式で `src/components/ui` に手動で用意 |
| アイコン | Lucide | |
| グラフ | Recharts 3 | 色は検証済みパレット（青・オレンジ・アクア、好評=青／不満=赤） |
| 通知 | sonner（トースト） | |
| テスト | Vitest | E2E（Playwright）は Phase 7 で追加予定 |
| DB・認証 | Supabase（PostgreSQL / Auth / RLS） | Phase 2 |
| 外部API | Google Business Profile API / OpenAI API / LINE Messaging API | Phase 3〜5 |
| ホスティング | Vercel | 親リポジトリのサイトとは別プロジェクト（Root Directory = `namara-review-v2`）として作成 |

## フォルダ構成

```
namara-review-v2/
├ src/app/
│  ├ (console)/            店舗向け画面（共通レイアウト＝サイドバー・店舗切替・下部メニュー）
│  │  ├ dashboard/ reviews/ replies/ reports/ settings/
│  │  ├ loading.tsx error.tsx
│  ├ admin/                運営管理（別レイアウト）
│  ├ login/
│  └ globals.css           デザイントークン
├ src/components/
│  ├ ui/                   shadcn/ui 形式の基本部品
│  ├ common/ layout/ charts/
│  └ dashboard/ reviews/ replies/ reports/ settings/ admin/
├ src/lib/
│  ├ types.ts              ドメイン型（DBの列名と対応）
│  ├ analytics.ts          集計・改善提案
│  ├ permissions.ts        権限表
│  ├ ai/reply-generator.ts 返信案（Phase 1 はテンプレート）と安全チェック
│  └ demo/                 サンプルデータ・状態遷移（reducer）・ブラウザ保存
├ tests/                   Vitest
└ docs/
```

## Phase 1 の仕組み（デモ）

- `src/lib/demo/seed.ts` が約1年分・3店舗の口コミを**決定的に**生成（毎回同じデータ）。
- 状態遷移はすべて `src/lib/demo/reducer.ts` の純粋関数に集約。権限・遷移条件・二重投稿防止・重複取り込み防止をここでチェックし、テストしている。
- `src/lib/demo/store.ts` が `useSyncExternalStore` で画面に配信し、ブラウザの localStorage に保存する（外部送信なし）。
- デモの「今日」は `DEMO_TODAY`（2026-10-21）に固定。Phase 2 で現在時刻に切り替える。

Phase 2 では `store.ts` を Supabase 経由のデータ取得と Server Actions に置き換え、`reducer.ts` の権限・遷移チェックはサーバー側のチェックと RLS に移す。

## データベース設計（Phase 2 で作成予定の案）

すべてのテーブルに `id uuid primary key`, `created_at`, `updated_at` を持たせる。

| テーブル | 主な列 | 制約・備考 |
| --- | --- | --- |
| organizations | name, plan | 契約単位（企業・個人店） |
| profiles | user_id(=auth.users.id), display_name, email | 利用者 |
| organization_members | organization_id, user_id, role(owner/manager/staff) | unique(organization_id, user_id) |
| stores | organization_id, name, short_name, genre, area, address, phone, hours | |
| store_members | store_id, user_id | 担当店舗。owner は全店舗を暗黙に担当 |
| reply_policies | store_id, tone, signature, rules jsonb, ng_words text[], low_rating_guidance, max_length | unique(store_id) |
| notification_settings | store_id, user_id, line_new_review, line_low_rating_only, low_rating_threshold, ... | |
| integration_connections | organization_id / store_id, provider(google/line), status, external_account_id, location_name, encrypted_refresh_token, token_expires_at, last_synced_at, last_error | トークンは暗号化して保存し、クライアントからは SELECT できない |
| reviews | store_id, google_review_id, author_name, rating, comment, review_created_at, reply_status, topics jsonb | **unique(store_id, google_review_id)** で重複取り込み防止 |
| reply_drafts | review_id, body, tone, source(ai/edited), version, updated_by, submitted_at, submitted_by | 編集のたびに version を増やす |
| reply_publications | review_id, draft_id, idempotency_key, status, attempt, error, actor_id | **unique(idempotency_key) where status='success'** で二重投稿防止 |
| line_links | user_id, line_user_id, linked_at | LINE アカウント連携（本人確認後のみ作成） |
| processed_events | source(line/google/cron), event_id | unique(source, event_id)。Webhook 再送や再実行の二重処理防止 |
| audit_logs | organization_id, actor_id, action, target_type, target_id, ip, user_agent | 追記のみ（更新・削除不可） |
| subscriptions | organization_id, plan, status(trial/active/past_due/cancelled), current_period_end, trial_ends_at | 決済は MVP 後 |
| platform_admins | user_id | 運営権限。店舗ユーザーの role とは別テーブル |

### RLS（行レベルセキュリティ）の方針

- 全テーブルで RLS を有効化。既定はすべて拒否。
- 判定用に `security definer` の関数（例：`is_org_member(org_id)`, `has_store_access(store_id)`, `has_role(org_id, roles[])`）を用意し、ポリシーから呼ぶ。
- 店舗データ（reviews, reply_drafts など）は `has_store_access(store_id)` が真のときのみ参照可能。
- 書き込みは役割で制限（例：reply_publications の作成は owner/manager のみ。staff は reply_drafts の作成・更新まで）。
- `organization_members.role` の更新は owner のみ、かつ owner への昇格は不可（トリガーで拒否）。
- `integration_connections` のトークン列・`platform_admins`・`audit_logs` の更新はクライアントから一切不可（サーバーの secret key 経由のみ）。
- 運営画面は `platform_admins` に登録された利用者のみ。店舗ユーザーの権限とは独立。
- RLS のテスト（他店舗のデータが見えない・権限昇格できない）を自動テストに含める。

## 外部連携の設計方針（Phase 3〜5、着手前に公式ドキュメントを再確認する）

### Google Business Profile API（Phase 3）
- OAuth 2.0（スコープ `https://www.googleapis.com/auth/business.manage`）。リフレッシュトークンは暗号化して保存。
- 口コミの一覧取得と返信の投稿・更新は、Google My Business API v4 の `accounts.locations.reviews`（list / updateReply）を使う想定。アカウント・ロケーションの取得は Account Management API / Business Information API。
- **API の利用には Google への利用申請と承認が必要**（承認前は割り当てが0）。承認が得られるまではモックで開発を続け、本番連携とは明確に分ける。
- 同期は定期実行＋差分取り込み。`unique(store_id, google_review_id)` で冪等にする。レート制限（429）には指数バックオフで再試行。
- 認証切れ・権限喪失は `integration_connections.status = error` にして画面と運営管理に表示。

### OpenAI API（Phase 4）
- サーバー側の Route Handler からのみ呼ぶ。入力は口コミ本文・評価・店舗の返信方針（投稿者名は渡さない）。
- 出力は `checkReply()` の安全チェックを必ず通す。生成結果は下書きとして保存し、**自動投稿しない**。
- 使用モデル・料金は着手時に確認し、オーナーの承認を得てから設定する。

### LINE Messaging API（Phase 5）
- Webhook は `x-line-signature`（チャネルシークレットによる HMAC-SHA256）を検証。`webhookEventId` を `processed_events` に記録して再送による二重処理を防ぐ。
- LINE アカウントの連携は、ログイン済みの Web 画面から発行した一時トークン（有効期限付き・1回限り）で本人確認してから `line_links` を作成。
- 初期実装では、通知のボタンから**認証済みの承認ページ**を開いて承認する方式にする（LINE 上のボタンだけで投稿まではしない）。承認ページはログイン必須・担当店舗チェック・CSRF 対策あり。

## セキュリティ

- 秘密情報は環境変数（Vercel の Environment Variables）で管理。`.env*` は Git 管理外（`.env.example` のみ管理）。
- `NEXT_PUBLIC_` 付きの環境変数には秘密情報を入れない。Supabase の secret key はサーバー専用モジュール（`server-only`）からのみ使う。
- セキュリティヘッダー（`X-Frame-Options: DENY` など）を `next.config.ts` で付与済み。
- 入力値はサーバー側で検証（Phase 2 で zod を導入予定）。
- 操作履歴は `audit_logs` に記録（Phase 1 は画面内の簡易ログのみ）。
