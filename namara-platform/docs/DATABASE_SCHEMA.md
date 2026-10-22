# データベース設計（DATABASE_SCHEMA）

本体：`supabase/migrations/20261022000000_initial_schema.sql`（**未適用**。Phase 2 で Supabase に適用）
テスト：`supabase/tests/rls_test.sql`（ローカル PostgreSQL 16 で 33 項目すべて合格）

## 1. 中心は共通店舗マスター

`stores.id`（store_id）を、なまらAIの推薦結果（`recommendation_items`）・行動ログ（`interaction_events`）・広告（`campaigns`）・口コミ（`reviews`）・アンケート・改善タスクがすべて参照します。

## 2. テーブル一覧

| 区分 | テーブル | 内容 |
| --- | --- | --- |
| 組織・権限 | `organizations` | 契約組織 |
| | `profiles` | ユーザー表示名（auth.users と 1:1） |
| | `platform_operators` | 運営者。service_role のみ追加可（権限昇格防止） |
| | `organization_members` | 組織メンバー（owner / staff） |
| | `store_members` | 店舗単位の担当者（スタッフ用） |
| | `plans` / `subscriptions` | 料金プラン（仮設定）と契約 |
| 店舗 | `store_categories` | エリア・ジャンル・シーン・希望条件の辞書（指示書の store_categories と store_features を統合） |
| | `stores` | 店舗マスター。価格は根拠必須、写真は出典必須、公開は検証済みのみ（CHECK 制約） |
| | `store_sources` | 情報源と更新履歴 |
| 消費者 | `consumer_identities` | LINE userId の HMAC 値のみ |
| | `consent_records` | 同意（目的・規約バージョン） |
| | `search_sessions` | 検索セッション |
| | `search_queries` | 検索文（90日で削除）と正規化条件（指示書の search_filters を列として統合） |
| | `recommendation_batches` / `recommendation_items` | 推薦結果と順位の理由（reasons） |
| | `interaction_events` | 9種類のイベント。`dedupe_key` UNIQUE で重複排除 |
| 広告 | `ad_placements` | 広告枠（search_sponsored、最大1） |
| | `campaigns` | キャンペーン（予算は `budget_yen`。指示書の ad_budgets を統合） |
| | `ad_impressions` / `ad_clicks` / `ad_billing_events` | 表示・クリック・課金を別記録。課金は1クリック1回（UNIQUE） |
| 口コミ | `integration_connections` | Google 等の連携。トークンは Vault に置き、ここは参照IDのみ |
| | `reviews` / `reply_drafts` / `reply_publications` | 口コミ・返信案（承認者必須）・投稿（idempotency_key UNIQUE、成功は1口コミ1件） |
| VOICE/ACTION | `surveys` / `survey_responses` / `action_tasks` | アンケート（個人情報列なし）・改善タスク |
| 監査 | `audit_logs` | 広告・店舗・組織メンバーの変更をトリガーで記録 |

## 3. RLS の方針

| データ | anon | 店舗ユーザー | 運営 | サーバー（service_role） |
| --- | --- | --- | --- | --- |
| 公開・検証済み店舗 | 読む | 読む | 全権 | 全権 |
| 自店の広告・口コミ・タスク | × | 読む（オーナーは書く） | 全権 | 全権 |
| 他社の店舗データ | × | **×** | 全権 | 全権 |
| 検索ログ・識別子・行動ログ | **×（権限ごと剥奪）** | **×** | 読む | 書く |
| 需要の集計 | × | `store_demand_by_genre()` 経由のみ（k=5抑制・丸め） | 読む | — |
| 監査ログ | × | × | 読む | トリガーで書く |

- 認可ヘルパー `is_operator()` / `can_access_store()` / `can_manage_store()` は `security definer` ＋ `search_path=''` 固定。
- 店舗オーナーは広告を「審査待ち」でしか作れず、更新できるのは「停止」だけ（トリガー `guard_campaign_update`）。

## 4. 保存期間・削除
- `purge_expired_search_text()`：90日を過ぎた `raw_text` を NULL に、13か月を過ぎた行動ログを削除（pg_cron で日次実行予定）。
- `delete_consumer_data(consumer_id)`：本人の識別子・同意・行動ログを削除し、検索条件は本人と切り離して残す。

## 5. ローカルでの検証方法

```bash
# PostgreSQL 16+ が必要（Windows は WSL 推奨）
bash supabase/tests/run-local.sh
```
`supabase/tests/00_supabase_stub.sql` は Supabase の `auth.uid()` とロールを真似るローカル専用ファイルで、本番には適用しません。

## 6. Phase 2 でやること
- Supabase プロジェクト作成（**費用・リージョンの確認が必要**）、マイグレーション適用
- サンプル店舗の投入スクリプト、サービス層の Supabase 実装への置き換え
- Supabase 公式の pgTAP（`supabase test db`）へのテスト移行
