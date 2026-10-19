# TABETUNAGU 店舗モニター（店舗スタッフ向け・ノータッチ表示）

閉店作業中の厨房やレジ横で、**画面を見るだけ**で今日の受け取り状況がわかる表示です。LINE ミニアプリ（LIFF）やタブレットでの常時表示を想定しています。

- 本日の状況：出品中 / 売上済（予約済み）/ 残り を特大の数字で
- 来店予定：受取待ちは黄色（受取時間を過ぎたらオレンジ）、受取完了はグレーの1行に
- お客様が店頭QRで受け取ると、自動で「受取完了」になり、チリン♪と鳴って画面が光る
- 今月の売上・お店の手取り（売上 − TABETUNAGU 手数料）と、STANDARD プランとの比較
- **隠し機能**：受取待ちのカードを長押しすると「手動で完了にする」（QR が読めなかったときのフェイルセーフ。「手動完了」として記録）
- 画面が消えないよう、対応ブラウザでは自動でスリープを止める

> TABETUNAGU は商品代金を預からない（お客様はお店のレジで支払う）ため、「振込予定額」ではなく「お店の手取り」を表示しています。

## ローカルで見る

```bash
cd tabetunagu/staff-dashboard
npm install
npm run dev        # http://localhost:5173 （同じ Wi-Fi のスマホ・タブレットからも開けます）
```

右上の「テスト」から、ダミーデータで次の動きを試せます。

| ボタン | 動き |
|---|---|
| お客様がQRで受け取る | 受取待ちの先頭1件が「受取完了」に（完了音・ハイライト・数字の更新） |
| 新しい予約が入る | 来店予定に1件追加（残りがあるときだけ） |
| 最初の状態に戻す | ダミーデータを作り直す |

完了音は、ブラウザの制約で**最初に1回画面に触れる**まで鳴りません（画面上部の「ここをタップすると…」）。

## 構成

```
src/
├─ App.tsx                    画面全体・更新の差分検知（完了音・ハイライト・お知らせ）
├─ components/
│  ├─ SummaryHeader.tsx       本日の状況（特大の数字）
│  ├─ Timeline.tsx            来店予定（受取待ち → 受取完了の順）
│  ├─ PickupCard.tsx          予約カード（色分け・長押し）
│  ├─ ConfirmModal.tsx        手動完了の確認
│  ├─ RevenuePanel.tsx        今月の売上・手取り・プラン比較
│  └─ DemoPanel.tsx           テスト操作（ダミーデータのときだけ）
├─ data/
│  ├─ types.ts                データの型（GAS が返す JSON と同じ形）
│  ├─ mock.ts                 ダミーデータ
│  ├─ gas.ts                  Google Apps Script から読み込む（ポーリング）
│  └─ source.ts               接続先の切り替え
└─ lib/
   ├─ chime.ts                完了音（Web Audio API で合成。音声ファイル不要）
   ├─ fees.ts                 手数料・手取りの計算（FREE 15% / STANDARD 4,980円＋5%）
   ├─ useLongPress.ts         長押し検出
   └─ useNow.ts               時計・画面スリープ防止
```

## Google Apps Script（GAS）とつなぐ

`.env.local` に GAS ウェブアプリの URL を設定し、店舗ID とトークンを URL で渡します。

```bash
VITE_GAS_ENDPOINT=https://script.google.com/macros/s/xxxxxxxx/exec
```

`https://（このページ）/?store=odori-bakery&token=（店舗ごとのトークン）`

GAS 側は次の2つに応えれば動きます（GAS はサーバーから画面へ通知できないため、画面が10秒ごとに取りに行きます）。

**GET** `?action=dashboard&store=…&token=…` → JSON

```json
{
  "storeName": "大通ベーカリー",
  "plan": "free",
  "listings": [{ "id": "l1", "name": "パンBOX", "quantity": 8 }],
  "pickups": [
    {
      "id": "r1", "code": "K6PEVG", "customerName": "山田様",
      "items": [{ "name": "パンBOX", "qty": 1 }],
      "start": 1760864400000, "end": 1760866200000, "total": 800,
      "status": "waiting"
    }
  ],
  "monthGmvBeforeToday": 118200,
  "updatedAt": 1760864000000
}
```

**POST**（Content-Type: `text/plain`。CORS のプリフライトを避けるため）

```json
{ "action": "complete", "store": "…", "token": "…", "pickupId": "r1", "via": "manual" }
```

お客様の QR チェックインは、LINE Messaging API の Webhook などで GAS がシートを `completed`（`completedVia: "qr"`）に更新すれば、次の更新で画面に反映され、完了音が鳴ります。

> 注意：トークンは店舗ごとに発行し、GAS 側で必ず照合してください。お客様の名前は「名字＋様」など最小限にしてください。
