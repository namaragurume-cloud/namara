# 全体アーキテクチャ（ARCHITECTURE）

## 1. 構成の考え方

**1つの Next.js アプリ（App Router）に、なまらAI・NAMARA REVIEW・運営管理・API をまとめています。**
指示書にあったモノレポ（apps/web, packages/shared …）は採用せず、同じ役割をフォルダで分けました。

| 指示書の案 | このプロジェクト | 理由 |
| --- | --- | --- |
| apps/web | `src/app/{ai,review,admin}` | 画面は1つのアプリで十分。デプロイ先も1つで済む |
| apps/api | `src/app/api/*`（Route Handlers）＋ Server Actions | 別サーバーを持たずに済み、Vercel にそのまま載る |
| packages/shared | `src/lib/shared`, `src/lib/search` など | 個人開発ではワークスペース管理の手間が大きい |
| packages/database | `supabase/migrations`, `supabase/tests` | Supabase CLI の標準配置 |

LINE 用の常駐ワーカーやバッチが必要になった時点（Phase 7 以降）で、`packages/` 分割を再検討します。

## 2. 技術構成

| 用途 | 採用 | 状態 |
| --- | --- | --- |
| フレームワーク | Next.js 16.3（App Router, Turbopack） | ✅ |
| 言語・UI | TypeScript（strict）/ Tailwind CSS v4 | ✅ |
| UI部品 | shadcn/ui の考え方（自前の小さな部品）＋ lucide-react | ✅ ※後述 |
| 入力検証 | Zod 4 | ✅ |
| テスト | Vitest 5（ロジック）＋ SQL による RLS テスト | ✅ |
| DB・認証 | Supabase（PostgreSQL / Auth / RLS / Vault） | ⚠️ スキーマのみ。未接続 |
| 検索 | 構造化フィルタ＋スコアリング。全文検索は pg_trgm、意味検索（pgvector）は必要になったら | ✅（メモリ上） |
| AI | OpenAI API（条件抽出のみ） | 🔲 未接続。辞書ベースで代替 |
| LINE | Messaging API | ⚠️ 署名検証・処理のみ。未接続 |
| Google | Business Profile API（口コミ）。Places API は利用条件を確認して判断 | 🔲 |
| ホスティング | Vercel | 🔲 未公開 |

**shadcn/ui について**：今回は CLI で導入せず、同じ考え方（Tailwind で書いた小さな部品を自分のコードとして持つ）の部品を `src/components/ui` に用意しました。フォーム・ダイアログなど複雑な部品が必要になった Phase 2 以降で、必要なものだけ shadcn/ui から追加します。

**Next.js 16 で変わった点（本プロジェクトで対応済み）**
- `params` / `searchParams` / `cookies()` は Promise（`await` が必要）
- `middleware` は `proxy` に改名（本プロジェクトは未使用。認可はサーバー側のサービス関数で実施）
- `next build` は Turbopack が既定。`next lint` は廃止され ESLint CLI を使う
- `after()` でレスポンス後の処理が書ける（LINE Webhook で使用）

## 3. 処理の流れ

```
[LINE] ──Webhook──▶ /api/line/webhook ─┐ 署名検証（生ボディ）→ 200 を即返す → after() で処理
[Web ] ──POST────▶ /api/search ─────────┤
                                         ▼
                     search-service.runSearch()
                     1 解析 parser.ts（辞書。将来 OpenAI）
                     2 正規化 normalizeConditions()
                     3 候補抽出 meetsHardConditions()
                     4 順位付け scoreStore()
                     5 新しさ確認（確認日）
                     6 上位5件
                     7 広告枠 selectSponsored()（条件に合う時だけ・別枠）
                     8 結果を返す（Flex Message / JSON）
                     9 計測 search_logs / interaction_events / ad_impressions
                                         ▼
                 クリック ─▶ /api/r（詳細・地図・予約）, /api/r/ad（広告）
                           計測してからサーバー側で決めた URL へリダイレクト
```

## 4. 権限と分離

| 主体 | 見られるもの |
| --- | --- |
| 消費者（匿名） | 公開・検証済み店舗のみ |
| 店舗スタッフ | 担当店舗のダッシュボード・需要（匿名集計）・広告（閲覧のみ） |
| 店舗オーナー | 組織内の店舗。広告の申請・停止 |
| 運営 | 全体。広告審査、店舗マスター、内部集計 |

- 画面ではなく **サービス関数の入口** で `assertStoreAccess` / `assertOperator` を必ず実行（`src/lib/server/authz.ts`）
- 本番は Supabase の **RLS** でも同じルールを強制（二重防御）。`supabase/tests/rls_test.sql` で検証済み
- 運営画面と店舗画面は URL・レイアウト・データ取得関数をすべて分離

## 5. モックと本番の切り替え

| 部分 | Phase 1（モック） | 本番 |
| --- | --- | --- |
| データ | `src/lib/server/db.ts`（メモリ、再起動で消える） | Supabase。サービス層の中身を差し替え |
| 認証 | デモアカウント（Cookie）。本番ビルドでは `NAMARA_DEMO_MODE=1` がない限り無効 | Supabase Auth |
| 検索条件の解析 | 辞書＋ルール | 辞書＋OpenAI（JSON出力を Zod 検証→同じ正規化関数） |
| LINE 返信 | `MockLineClient` に記録 | `HttpLineClient`（`LINE_REPLY_ENABLED=1` の時のみ） |
| 口コミ | 合成データ | Google Business Profile API |
| AI店長 | ルールベース | ルールで根拠を計算→文章化だけ AI（数値は AI に作らせない） |
| レート制限 | メモリ（1インスタンス内のみ有効） | DB または KV ストア |

## 6. 非同期処理（LINE）
- LINE には署名検証後すぐ 200 を返し、検索と返信は `after()` で実行。
- 検索はメモリ／DB 上の処理で通常1秒未満。OpenAI 接続後に返信期限を超えるおそれがある場合は、
  `line_jobs` キュー（Supabase テーブル＋定期実行）に積み、Push API で返す設計にする（Push は通数課金のため承認後）。
- 同じ `webhookEventId` は1回だけ処理（再送対策）。

## 7. 消費者向けLINEと店舗通知の分離
- なまらAI：`LINE_CHANNEL_*`（なまらグルメ公式LINE）
- 店舗通知（週次レポート等）：`LINE_STORE_NOTIFY_*`（別チャネル）。消費者の友だちリストと混在させない。
