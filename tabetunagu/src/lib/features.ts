import "server-only";
import { env } from "@/server/env";

/**
 * 機能フラグ（ここ以外で環境変数を見て分岐しないこと）。
 *
 * ENABLE_V2_CHECKOUT … v2（事前決済）をメインの購入導線にする
 *   - "true"  : ON（商品詳細の CTA・ナビ・マイページが v2 の注文・受取チケットになる）
 *   - それ以外: OFF（旧フロー: 予約 → 店頭 QR → お店で支払い）。未設定は OFF
 *   production では明示的に "true" にしない限り OFF。ON にする前に POC_GO_LIVE_CHECKLIST.md を満たすこと。
 *   OFF に戻せば即時に旧導線へ戻る（旧フローのコード・画面は残している）。
 *
 * production の安全ガード:
 *   ENABLE_V2_CHECKOUT=true でも、決済・定期処理に必要な設定（V2_REQUIRED_SETTINGS）が1つでも欠けていれば
 *   v2 は強制的に OFF（旧導線）になり、サーバーログと管理画面「PoC 公開準備」に不足項目を出す。
 *   起動時エラーにしないのは、設定ミスで旧導線まで止めないため（安全側 = 旧導線で動き続ける）。
 */

export const V2_REQUIRED_SETTINGS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_CHECKOUT_RETURN_URL",
  "CRON_SECRET",
] as const;

export type V2Readiness = {
  /** ENABLE_V2_CHECKOUT=true が設定されている */
  requested: boolean;
  /** production の安全ガードが効く環境か */
  enforced: boolean;
  /** 不足・不正な設定（値そのものは含めない） */
  missing: (typeof V2_REQUIRED_SETTINGS)[number][];
  /** 実際に v2 がメインの導線になっているか */
  effective: boolean;
};

function settingOk(key: (typeof V2_REQUIRED_SETTINGS)[number]): boolean {
  try {
    switch (key) {
      case "STRIPE_SECRET_KEY":
        return Boolean(env.stripe.secretKey);
      case "STRIPE_WEBHOOK_SECRET":
        return Boolean(env.stripe.webhookSecret);
      case "STRIPE_CHECKOUT_RETURN_URL": {
        const raw = process.env.STRIPE_CHECKOUT_RETURN_URL || "";
        return /^https:\/\/[^\s]+$/.test(raw);
      }
      case "CRON_SECRET":
        return env.cronSecret.length >= 16;
    }
  } catch {
    // 形式が不正な鍵は env が例外を投げる（production）。不足として扱う
    return false;
  }
}

let warned = false;

export function v2Readiness(): V2Readiness {
  const requested = process.env.ENABLE_V2_CHECKOUT === "true";
  const enforced = env.isProduction;
  const missing = V2_REQUIRED_SETTINGS.filter((k) => !settingOk(k));
  const effective = requested && (!enforced || missing.length === 0);
  if (requested && !effective && !warned) {
    warned = true;
    console.error(`[features] ENABLE_V2_CHECKOUT=true but required settings are missing: ${missing.join(", ")}. v2 checkout stays OFF.`);
  }
  return { requested, enforced, missing, effective };
}

export const features = {
  /** v2 がメインの購入導線か（production では必要な設定がそろっている場合のみ） */
  get v2Journey(): boolean {
    return v2Readiness().effective;
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
