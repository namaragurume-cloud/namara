import type { MetadataRoute } from "next";
import { cases } from "@/data/cases";
import { site } from "@/data/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1 },
    { path: "/service", priority: 0.9 },
    { path: "/pricing", priority: 0.9 },
    { path: "/contact", priority: 0.9 },
    { path: "/works", priority: 0.8 },
    { path: "/creators", priority: 0.8 },
    { path: "/about", priority: 0.7 },
    { path: "/faq", priority: 0.7 },
    { path: "/partner", priority: 0.6 },
    { path: "/company", priority: 0.5 },
    { path: "/privacy", priority: 0.3 },
  ];
  const now = new Date();
  return [
    ...pages.map((p) => ({ url: `${site.url}${p.path}`, lastModified: now, priority: p.priority })),
    // 公開済みの実績のみ（プレビュー設定に関係なく published のものだけ）
    ...cases
      .filter((c) => c.published)
      .map((c) => ({ url: `${site.url}/works/${c.slug}`, lastModified: now, priority: 0.6 })),
  ];
}
