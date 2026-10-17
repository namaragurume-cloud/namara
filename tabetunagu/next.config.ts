import path from "node:path";
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // QRチェックインのため自サイトのカメラのみ許可
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  // LINE のプロフィール画像
  { protocol: "https", hostname: "profile.line-scdn.net" },
];
if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  const { hostname } = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  remotePatterns.push({ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // リポジトリ直下にも別の Next.js アプリ（MIRATSUMU サイト）があるため、ルートを明示する
  turbopack: { root: path.resolve(__dirname) },
  // PGlite（ローカル用の組み込み PostgreSQL）は WASM を読み込むためバンドルしない
  serverExternalPackages: ["@electric-sql/pglite"],
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns,
  },
  experimental: {
    serverActions: {
      // 商品写真のアップロード（クライアントで縮小してから送るため通常は数百KB）
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
