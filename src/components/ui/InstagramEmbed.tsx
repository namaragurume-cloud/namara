"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

/** Instagram の公開投稿・リールを埋め込み表示（Instagram 公式の埋め込みコード） */
export function InstagramEmbed({ url }: { url: string }) {
  useEffect(() => {
    window.instgrm?.Embeds.process();
  }, [url]);

  return (
    <div className="mx-auto w-full max-w-[540px]">
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={`${url}?utm_source=ig_embed`}
        data-instgrm-version="14"
        style={{ background: "#fff", border: 0, margin: 0, maxWidth: 540, minWidth: 280, width: "100%" }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer" className="block p-6 text-center text-sm font-bold underline">
          Instagramで投稿を見る
        </a>
      </blockquote>
      <Script
        src="https://www.instagram.com/embed.js"
        strategy="lazyOnload"
        onLoad={() => window.instgrm?.Embeds.process()}
      />
    </div>
  );
}
