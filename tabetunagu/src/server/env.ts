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
