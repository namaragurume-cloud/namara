import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "KITACRE（キタクリ）- Hokkaido Creator Casting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 共通の OGP 画像（日本語フォントを同梱しないため、ロゴと英字で構成）。
 * 正式な OGP 画像を用意した場合は、このファイルを削除して src/app/opengraph-image.png として配置してください。
 */
export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/images/brand/kitacre-logo-white.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 36,
          background: "radial-gradient(circle at 85% 10%, #5a1219 0%, #111111 60%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        { }
        <img src={src} width={496} height={322} alt="" />
        <div style={{ display: "flex", fontSize: 24, letterSpacing: 8, color: "rgba(255,255,255,0.65)" }}>
          HOKKAIDO GOURMET INFLUENCER CASTING
        </div>
      </div>
    ),
    size,
  );
}
