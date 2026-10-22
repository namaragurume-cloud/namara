@AGENTS.md

# NAMARA PLATFORM — 開発メモ（AI・開発者向け）

なまらグルメが運営する2サービスの統合プラットフォーム。
- **なまらAI**：消費者向け・無料の LINE グルメ検索（`/ai` は Web 版デモ）
- **NAMARA REVIEW**：飲食店向け・有料 SaaS（`/review`）
- **運営管理**：なまらグルメ運営専用（`/admin`）

詳細は `README.md` と `docs/` を参照。進捗は必ず `docs/PROGRESS.md` に記録する。

## 絶対に守ること
- 店舗名・価格・営業時間・空席を AI に作らせない。不明なものは「不明」と表示する。
- 推薦（`src/lib/search/ranking.ts`）は構造化データで行う。AI は条件抽出のみ。
- 広告は「広告／スポンサー」表記の別枠（最大1件）。通常順位を広告費で変えない。検索条件に合わない広告は出さない。
- 店舗向けには匿名集計のみ（少数セル抑制 k=5・5単位丸め）。生の検索文やセッションIDを店舗に返さない。
- 検索回数と来店数を混同しない。デモ用合成データは画面で必ず明示する。
- 口コミの評価を操作する機能（高評価者だけ口コミ誘導、口コミ投稿を条件にした特典）は作らない。
- 有料API接続・本番データ変更・公開・破壊的操作はオーナーの事前承認が必要。
- 秘密情報をコード・Git・ログに出さない。LINE userId は HMAC 化してから扱う。
- 既存の `namara-review` / `namara-review-v2` には触れない。親フォルダの MIRATSUMU サイトも変更しない（ビルド除外設定のみ）。

## 構成
- `src/lib/shared` 共通型・辞書 / `src/lib/search` 解析と推薦 / `src/lib/ads` 広告選定と課金判定
- `src/lib/analytics` 匿名集計・AI店長（ルールベース） / `src/lib/line` LINE 連携
- `src/lib/server` 認可（`authz.ts`）・モックDB（`db.ts`）・サービス層（必ず Actor で認可してからデータを返す）
- `supabase/migrations` 本番用スキーマ＋RLS / `supabase/tests` RLS テスト

## コミット前
`npm run lint && npm run typecheck && npm test && npm run build`
DB を変えたら `supabase/tests/run-local.sh` でも RLS テストを実行する（ローカル PostgreSQL が必要）。
