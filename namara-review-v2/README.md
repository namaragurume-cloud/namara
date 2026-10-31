# NAMARA REVIEW

飲食店向けAI口コミ管理SaaS（運営：なまらグルメ）。
Google口コミの確認・AI返信案の作成と承認・分析を一つの管理画面で行い、LINEから簡単に対応できることを目指しています。

> **現在は Phase 1（デモ版）です。** サンプルデータで動作し、Google・OpenAI・LINE・Supabase には接続していません。
> 実装状況は [docs/PROGRESS.md](docs/PROGRESS.md) を見てください。

## 必要なもの

- Node.js 20.9 以上（推奨：22 LTS）… https://nodejs.org/ja から「LTS」をインストール
- Git

## 起動方法（Windows PowerShell）

初回だけ、GitHub からプログラムをダウンロードします（「ドキュメント」フォルダに置く例）。

```powershell
cd $HOME\Documents
git clone -b claude/determined-mccarthy-vajig3 https://github.com/namaragurume-cloud/namara.git
```

起動するとき：

```powershell
# 1. このフォルダへ移動
cd $HOME\Documents\namara\namara-review-v2

# 2. 最新版を取得（2回目以降）
git pull

# 3. 部品をインストール（初回と、package.json が変わったときだけ）
npm.cmd install

# 4. 開発用サーバーを起動
npm.cmd run dev
```

ブラウザで http://localhost:3000 を開くとログイン画面が表示されます。止めるときは PowerShell で `Ctrl + C`。

> PowerShell で「スクリプトの実行が無効」と表示される場合は、`npm` ではなく `npm.cmd`、`npx` ではなく `npx.cmd` を使ってください。

## よく使うコマンド

| 目的 | コマンド |
| --- | --- |
| 開発サーバー | `npm.cmd run dev` |
| コードの書き方チェック | `npm.cmd run lint` |
| 型チェック | `npm.cmd run typecheck` |
| 自動テスト | `npm.cmd run test` |
| 本番ビルド | `npm.cmd run build` |
| 上の4つをまとめて | `npm.cmd run check` |
| 本番ビルドを手元で起動 | `npm.cmd run build` の後に `npm.cmd run start` |

## デモの使い方

- **法人ごとに専用ページ（`/o/法人ID/…`）とデータが分かれています。** ログイン画面の「デモ用アカウントで試す」から法人と担当者を選ぶと、その法人の専用ページが開きます。
  - 例：北海フードサービス → http://localhost:3000/o/hokkai-food/dashboard
  - 別の法人のURLを直接開いても表示されません。
- 画面右上のアカウントメニューから、同じ法人内の**ログインユーザー（オーナー／店長／スタッフ）を切り替え**て権限の違いを確認できます。
- 運営管理画面（http://localhost:3000/admin ）の「法人の専用ページを発行」で、新しい契約法人の専用ページを作れます。発行したオーナーのメールアドレスでログインし、店舗設定から店舗を追加できます（プランの店舗数まで）。
- 操作内容（返信案・設定など）は**このブラウザにだけ保存**されます。アカウントメニューの「デモデータを初期状態に戻す」でリセットできます。
- 「口コミを同期」ボタンで、Googleから新着口コミが届いた想定のデータが追加されます。
- 店舗設定 →「連携」タブの「投稿失敗をシミュレートする」をオンにすると、投稿失敗と再試行の流れを確認できます。

## 1ファイル版デモ（サーバー不要）

`demo/namara-review-demo.html` をダブルクリックすると、ブラウザだけでデモが開きます（インターネットには送信しません）。
本体と同じサンプルデータ・AI返信・集計・権限チェックを使っています。再読み込みすると初期状態に戻ります。
本体を変更したら `npm.cmd run demo:build` で作り直してください。

## 環境変数

Phase 1 では不要です。Phase 2 以降で `.env.example` をコピーして `.env.local` を作り、値を設定します。
`.env.local` は Git に保存されません。APIキーをチャットやソースコードに貼らないでください。

## ドキュメント

- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) … サービス仕様
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) … 技術構成・データベース設計
- [docs/ROADMAP.md](docs/ROADMAP.md) … 開発計画
- [docs/PROGRESS.md](docs/PROGRESS.md) … 実装状況
