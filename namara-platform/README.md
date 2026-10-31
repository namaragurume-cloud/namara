# NAMARA PLATFORM

北海道のグルメメディア「なまらグルメ」が運営する、2つのサービスの統合プラットフォームです。

| サービス | 対象 | 料金 | URL（ローカル） |
| --- | --- | --- | --- |
| **なまらAI** | 消費者 | 無料 | `/ai`（Web版チャットデモ。本番はLINE） |
| **NAMARA REVIEW** | 飲食店 | 有料SaaS | `/review` |
| **運営管理** | なまらグルメ運営 | — | `/admin` |

> **現在は Phase 1（ローカルデモ）です。** 店舗・口コミ・検索データはすべて架空で、外部API（LINE・Google・OpenAI・Supabase）には接続していません。

---

## 1. はじめての起動（Windows）

1. [Node.js](https://nodejs.org/ja) の LTS 版（20.9 以上）をインストール
2. PowerShell でこのフォルダに移動

   ```powershell
   cd namara-platform
   npm install
   npm run dev
   ```

3. ブラウザで <http://localhost:3000> を開く

`.env.local` は無くても動きます（必要になったら `.env.example` をコピーして作成）。

## 2. デモの触り方

- **なまらAI**：トップ →「なまらAI」→ 例文ボタンを押すか自由に入力（例：「すすきの 焼肉 予算8000円」）
  - 「札幌 イタリアン」で検索すると、通常の5件の下に **「広告（スポンサー）」** 枠が表示されます
- **NAMARA REVIEW**：トップの「デモアカウント」で店舗オーナーを選ぶ
  - ダッシュボード／NAMARA DEMAND（検索需要）／スポンサー広告（申請→運営の審査）
  - 「店舗スタッフ」は閲覧のみ、他社店舗の URL を開いても「アクセスできません」になります
- **運営管理**：デモアカウント「なまらグルメ運営」を選ぶ
  - 広告審査（承認・否認・停止）、店舗マスター（公開／非公開・確認日更新）、検索需要、ゼロ件分析、料金プラン

デモ操作の記録（検索・広告申請など）はサーバーを止めると消えます。

### サーバー無しで見られる1ファイル版デモ

`demo/namara-demo.html` をダウンロードして Chrome / Edge で開くだけで、上の3画面を操作できます（検索・推薦・広告・集計は本体と同じロジックを埋め込み）。
ロジックや画面（`demo/ui.js`）を変えたら `npm run demo:build` で作り直してください。

## 3. よく使うコマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run lint` | コードの書き方チェック |
| `npm run typecheck` | 型チェック |
| `npm test` | 自動テスト（解析・推薦・広告・集計・権限分離・LINE） |
| `npm run build` | 本番用ビルド |
| `npm run check` | 上の4つをまとめて実行 |
| `npm run demo:build` | 1ファイル版デモ `demo/namara-demo.html` を作り直す |
| `bash supabase/tests/run-local.sh` | DB の RLS テスト（ローカルに PostgreSQL 16+ が必要。Windows では WSL 推奨） |

## 4. フォルダ構成

```
namara-platform/
├─ src/
│  ├─ app/               画面と API（Next.js App Router）
│  │  ├─ ai/             なまらAI（消費者向け）
│  │  ├─ review/         NAMARA REVIEW（店舗向け）
│  │  ├─ admin/          運営管理
│  │  └─ api/            search / events / r（計測リダイレクト） / line/webhook
│  ├─ components/        画面部品
│  └─ lib/
│     ├─ shared/         共通の型・辞書（エリア・ジャンル等）     ← 「packages/shared」相当
│     ├─ search/         検索文の解析・推薦エンジン
│     ├─ ads/            広告枠の選定・クリック課金判定
│     ├─ analytics/      匿名集計・AI店長の提案
│     ├─ line/           LINE 署名検証・Flex Message・Webhook 処理
│     ├─ security/       レート制限・識別子のハッシュ化
│     ├─ data/           架空のサンプル店舗・デモ用合成データ・料金プラン
│     └─ server/         認可・モックDB・サービス層
├─ supabase/
│  ├─ migrations/        本番用 DB スキーマ（RLS 付き）      ← 「packages/database」相当
│  └─ tests/             RLS テスト
├─ tests/                Vitest の自動テスト
└─ docs/                 設計・運用ドキュメント
```

モノレポにせず **1つの Next.js アプリ** にしています。理由は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照。

## 5. ドキュメント

- [PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) 製品仕様
- [ARCHITECTURE.md](docs/ARCHITECTURE.md) 全体設計
- [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) DB設計・RLS
- [SEARCH_RANKING.md](docs/SEARCH_RANKING.md) 検索・推薦ロジック
- [AD_POLICY.md](docs/AD_POLICY.md) 広告ポリシー
- [PRIVACY_DESIGN.md](docs/PRIVACY_DESIGN.md) プライバシー設計
- [API_INTEGRATIONS.md](docs/API_INTEGRATIONS.md) 外部API連携の準備
- [ROADMAP.md](docs/ROADMAP.md) 開発ロードマップ
- [PROGRESS.md](docs/PROGRESS.md) 進捗（完成・未完成の区別）

## 6. 守っているルール（抜粋）

- 店舗名・価格・営業時間・空席状況を AI が作ることはありません。不明な情報は「不明」と表示します。
- 広告は「広告（スポンサー）」と明示した別枠（最大1件）で、通常のおすすめ順位は変わりません。
- 飲食店に提供するのは個人を特定できない匿名集計だけです。検索回数は来店数ではありません。
- 口コミ評価を不当に操作する機能（高評価者だけを口コミに誘導する等）は実装しません。
- 有料APIの接続・本番公開・本番データの変更は、オーナーの承認後に行います。
