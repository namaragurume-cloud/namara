import { ImageResponse } from "next/og";

export const alt = "NAMARA GOURMET CASTING - Hokkaido Gourmet Influencer Casting";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 共通の OGP 画像（日本語フォントを同梱しないため英字で構成）。
 * 正式な OGP 画像を用意した場合は public/ に置き、このファイルを削除して
 * src/app/opengraph-image.png として配置してください。
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(circle at 85% 10%, #6b1a22 0%, #111111 55%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22, letterSpacing: 8, color: "rgba(255,255,255,0.7)" }}>
          <div style={{ width: 48, height: 3, background: "#c91f2d" }} />
          HOKKAIDO GOURMET INFLUENCER CASTING
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>NAMARA</div>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2, lineHeight: 1.1 }}>GOURMET CASTING</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "rgba(255,255,255,0.6)" }}>
          <span>Sapporo, Hokkaido</span>
          <span>Instagram @namaragurume</span>
        </div>
      </div>
    ),
    size,
  );
}
