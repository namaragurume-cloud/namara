import type { Metadata } from "next";
import { site } from "@/data/site";

/** ページごとの title / description / canonical / OGP をまとめて生成 */
export function pageMetadata({
  title,
  description,
  path,
  noindex,
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: site.locale,
      siteName: site.title,
      title: `${title}｜${site.title}`,
      description,
      url: path,
    },
    robots: noindex ? { index: false, follow: true } : undefined,
  };
}
