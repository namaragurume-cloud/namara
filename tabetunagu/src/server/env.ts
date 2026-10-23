import "server-only";

/**
 * サーバー専用の環境変数。秘密情報はここ以外から参照しない（クライアントに渡さない）。
 * NEXT_PUBLIC_ が付くものだけがブラウザに公開される。
 */

type AppEnv = "development" | "preview" | "production";

function appEnv(): AppEnv {
  const explicit = process.env.APP_ENV;
  if (explicit === "production" || explicit === "preview" || explicit === "development") return explicit;
  if (process.env.VERCEL_ENV === "production") return "production";
  if (process.env.VERCEL_ENV === "preview") return "preview";
  return "development";
}

const DEV_FALLBACK_SECRET = "tabetunagu-local-dev-secret-do-not-use-in-production";

function secret(name: "AUTH_SECRET" | "QR_SIGNING_SECRET"): string {
  const value = process.env[name];
  if (value && value.length >= 32) return value;
  if (appEnv() === "production") {
    throw new Error(`${name} must be set (32+ characters) in production`);
  }
  return `${DEV_FALLBACK_SECRET}:${name}`;
}

/** Stripe の鍵。形式が正しくない値は本番では起動時エラー、それ以外では未設定として扱う */
function stripeKey(name: "STRIPE_SECRET_KEY" | "STRIPE_WEBHOOK_SECRET", pattern: RegExp): string {
  const value = (process.env[name] || "").trim();
  if (!value) return "";
  if (pattern.test(value)) return value;
  if (appEnv() === "production") {
    throw new Error(`${name} has an invalid format`);
  }
  return "";
}

export const env = {
  get appEnv() {
    return appEnv();
  },
  get isProduction() {
    return appEnv() === "production";
  },
  get appUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get databaseUrl() {
    return process.env.DATABASE_URL || "";
  },
  get authSecret() {
    return secret("AUTH_SECRET");
  },
  get qrSecret() {
    return secret("QR_SIGNING_SECRET");
  },
  get cronSecret() {
    return process.env.CRON_SECRET || "";
  },
  /**
   * デモログイン（開発確認用）。本番（APP_ENV / VERCEL_ENV = production）では常に無効。
   * それ以外は ENABLE_DEMO_LOGIN=true で有効。未設定時は next dev のときだけ有効。
   */
  get demoLoginEnabled() {
    if (appEnv() === "production") return false;
    const flag = process.env.ENABLE_DEMO_LOGIN;
    if (flag === "true") return true;
    if (flag === "false") return false;
    return process.env.NODE_ENV !== "production";
  },
  line: {
    get liffId() {
      return process.env.NEXT_PUBLIC_LIFF_ID || "";
    },
    get channelId() {
      return process.env.LINE_CHANNEL_ID || "";
    },
    get channelSecret() {
      return process.env.LINE_CHANNEL_SECRET || "";
    },
    get messagingAccessToken() {
      return process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
    },
    get loginEnabled() {
      return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
    },
  },
  openai: {
    get apiKey() {
      return process.env.OPENAI_API_KEY || "";
    },
    get model() {
      return process.env.OPENAI_MODEL || "gpt-5-mini";
    },
  },
  /**
   * Stripe（事前決済・Connect）。秘密鍵・Webhook 署名鍵はサーバー専用。
   * Checkout（Stripe のホストする決済ページ）を使うため、公開可能キーは使わない。
   */
  stripe: {
    get secretKey() {
      return stripeKey("STRIPE_SECRET_KEY", /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/);
    },
    get webhookSecret() {
      return stripeKey("STRIPE_WEBHOOK_SECRET", /^whsec_[A-Za-z0-9]+$/);
    },
    get enabled() {
      return Boolean(this.secretKey);
    },
    /**
     * Checkout から戻る先のベース URL（success / cancel）。未設定なら NEXT_PUBLIC_APP_URL。
     * LINE ミニアプリ内に戻す場合は https://miniapp.line.me/<LIFF ID> を設定する（2023/12 以降の LINE ミニアプリの URL。
     * 旧形式の https://liff.line.me/<LIFF ID> も開けるが新しくは使わない。line://app/... は使わない）。
     */
    get checkoutReturnUrl() {
      return (process.env.STRIPE_CHECKOUT_RETURN_URL || env.appUrl).replace(/\/$/, "");
    },
    /** 使う決済手段を固定する Payment Method Configuration（例: カードのみ）。未設定なら Stripe の既定 */
    get paymentMethodConfiguration() {
      return process.env.STRIPE_PAYMENT_METHOD_CONFIGURATION || "";
    },
  },
  storage: {
    get supabaseUrl() {
      return (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
    },
    get serviceRoleKey() {
      return process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    },
    get bucket() {
      return process.env.SUPABASE_STORAGE_BUCKET || "product-images";
    },
  },
};
