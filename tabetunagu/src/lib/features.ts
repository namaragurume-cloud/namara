import "server-only";
import { env } from "@/server/env";

/**
 * 機能フラグ（ここ以外で環境変数を見て分岐しないこと）。
 *
 * ENABLE_V2_CHECKOUT … v2（事前決済）をメインの購入導線にする
 *   - "true"  : ON（商品詳細の CTA・ナビ・マイページが v2 の注文・受取チケットになる）
 *   - それ以外: OFF（旧フロー: 予約 → 店頭 QR → お店で支払い）。未設定は OFF
 *   production では明示的に "true" にしない限り OFF。ON にする前に README「v2 本番導線 ON の条件」を満たすこと。
 *   OFF に戻せば即時に旧導線へ戻る（旧フローのコード・画面は残している）。
 */
export const features = {
  /** v2 がメインの購入導線か */
  get v2Journey(): boolean {
    return process.env.ENABLE_V2_CHECKOUT === "true";
  },
  /**
   * v2 の購入（決済開始）を受け付けるか。
   * production では v2Journey が ON のときだけ。production 以外（開発・プレビュー）では、
   * OFF でも URL を直接開けば確認できる（STEP 2〜3 と同じ）。
   * 決済済みの注文の受取・返金・Webhook はフラグに関係なく動く（既存の注文を止めない）。
   */
  get v2CheckoutOpen(): boolean {
    return this.v2Journey || !env.isProduction;
  },
};
