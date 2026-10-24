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
    /**
     * 日次注目商品通知（「今夜の食べつなぎ」。通知を ON にしたユーザーへの Push）を実際に LINE へ送るか（正式な安全装置）。
     * LINE_CHANNEL_ACCESS_TOKEN を設定しただけでは送らない（自分へのテスト送信のためにトークンを設定しても、
     * 対象ユーザーに配信されないように）。ENABLE_LINE_DIGEST_SEND=true のときだけ送り、それ以外は dry run（記録のみ）。
     */
    get digestSendEnabled() {
      return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN) && process.env.ENABLE_LINE_DIGEST_SEND === "true";
    },
    /**
     * 定期処理（Vercel Cron の /api/cron/digest）で日次注目商品通知を実行するか。既定は無効（呼ばれても何もしない）。
     * 有効にしても、実際に LINE へ送るのは digestSendEnabled（ENABLE_LINE_DIGEST_SEND=true）のときだけ。それ以外は dry run。
     */
    get digestCronEnabled() {
      return process.env.ENABLE_LINE_DIGEST_CRON === "true";
    },
    get loginEnabled() {
      return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
    },
    /**
     * LINE ミニアプリのチャネル（サービスメッセージ用の channel access token の発行に使う）。
     * 未設定なら LINE Login のチャネル（LINE_CHANNEL_ID / SECRET）。LIFF アプリを置いたチャネルと同じにする。
     */
    get miniAppChannelId() {
      return process.env.LINE_MINIAPP_CHANNEL_ID || process.env.LINE_CHANNEL_ID || "";
    },
    get miniAppChannelSecret() {
      return process.env.LINE_MINIAPP_CHANNEL_SECRET || process.env.LINE_CHANNEL_SECRET || "";
    },
    /**
     * サービスメッセージの送信デモ（管理者のみ）。本番（APP_ENV / VERCEL_ENV = production）では常に無効。
     * それ以外も ENABLE_LINE_NOTIFICATION_DEMO=true のときだけ有効（既定は無効）。
     */
    get serviceMessageDemoEnabled() {
      if (appEnv() === "production") return false;
      return process.env.ENABLE_LINE_NOTIFICATION_DEMO === "true";
    },
    /**
     * 「今日の食べつなぎ」（注目商品）の LINE 公式アカウントからのテスト送信（管理者が自分にだけ1件送る）。
     * ENABLE_LINE_MARKETING_DEMO=true のときだけ有効（既定は無効）。実機確認のため、本番環境でも明示的に有効にできる。
     * 有効にしても送れるのは「管理者が、自分自身の LINE に、Push で1件」だけ（services/line-marketing）。
     * Broadcast / Multicast / 定期処理での配信はこのフラグでは有効にならない（まとめ通知は ENABLE_LINE_DIGEST_SEND で別に管理）。
     */
    get marketingDemoEnabled() {
      return process.env.ENABLE_LINE_MARKETING_DEMO === "true";
    },
    /** 注文完了（予約完了）に使うテンプレート名（例: xxxx_ja。LINE Developers コンソールで選んだテンプレート） */
    get serviceMessageOrderTemplate() {
      return process.env.LINE_SERVICE_MESSAGE_ORDER_TEMPLATE || "";
    },
    /** テンプレート変数 → TABETUNAGU の項目の対応（JSON。例: {"shop_name":"storeName","item":"items"}） */
    get serviceMessageOrderParams() {
      return process.env.LINE_SERVICE_MESSAGE_ORDER_PARAMS || "";
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
