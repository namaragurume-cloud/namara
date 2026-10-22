@AGENTS.md

# NAMARA REVIEW 開発方針

飲食店向けAI口コミ管理SaaS。運営はなまらグルメ。コンセプトは「口コミ管理は、AIにおまかせ。お店はお客様に集中できる。」

## 前提
- このフォルダ（`namara-review-v2`）は独立した Next.js アプリ。親フォルダはなまらグルメ（MIRATSUMU）のサイトで別物。旧 `namara-review` は参照・上書きしない。
- オーナーはプログラミング初心者。説明は日本語で「何ができたか・次に何をするか・オーナーが操作すること」を優先する。操作手順は Windows PowerShell 向け（`npm.cmd` / `npx.cmd`）。
- 現在の段階と実装状況は `docs/PROGRESS.md`、計画は `docs/ROADMAP.md`。作業後は必ず更新する。

## 守ること
- 未実装・モックの機能を完成済みと書かない。外部連携のモックは画面上も「デモ」「Phase N で実装」と明示する。
- Phase 2 以降の外部サービス連携（Supabase・Google・OpenAI・LINE・Vercel）は、オーナーの確認を取ってから着手する。有料API・外部送信・公開・破壊的操作も事前確認。
- APIキー・パスワードをソースコードや Git に入れない。サーバー専用の値に `NEXT_PUBLIC_` を付けない。
- AI は返信を自動投稿しない。必ず担当者（オーナー・店長）の承認を経る。
- 権限チェックは画面の出し分けだけにしない。Phase 1 は `src/lib/demo/reducer.ts`、Phase 2 以降はサーバー側＋RLS で強制する。
- 返信の投稿は冪等キー（口コミID:返信案の版数）で二重投稿を防ぐ。
- マルチテナント：すべてのデータは法人（organization）に属する。店舗へのアクセスは「同じ法人」かつ「担当店舗」の両方を満たす場合だけ（`canAccessStore`）。他法人の存在や社名が分かる表示をしない。

## コード構成
- 画面: `src/app/o/[org]/*`（法人専用ページ。`OrgGate` が所属法人と URL の一致を確認）、`src/app/admin`（運営向け）、`src/app/login`
- 法人内のリンクは必ず `useOrgHref()` で `/o/{slug}` を付ける。法人ID（slug）のルールは `src/lib/organizations.ts`
- 画面部品: `src/components/<機能>/`、共通部品 `src/components/common`、UI基盤 `src/components/ui`（shadcn/ui 形式）
- ドメイン: `src/lib/types.ts`（型）、`analytics.ts`（集計）、`permissions.ts`（権限表）、`ai/reply-generator.ts`（返信案・安全チェック）
- デモデータと状態: `src/lib/demo/`（seed・reducer・store）。Phase 2 で Supabase に置き換える
- 色・余白などのデザイントークンは `src/app/globals.css` にだけ定義し、コンポーネントでは役割名（`bg-primary` など）で使う

## コミット前
```
npm run lint && npm run typecheck && npm run test && npm run build
```
（`npm run check` で一括実行）。機能単位でコミットする。
