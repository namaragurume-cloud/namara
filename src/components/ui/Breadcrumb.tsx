import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { absoluteUrl } from "@/lib/utils";
import { JsonLd } from "./JsonLd";

export type Crumb = { label: string; href: string };

export function Breadcrumb({ items }: { items: Crumb[] }) {
  const all = [{ label: "トップ", href: "/" }, ...items];
  return (
    <>
      <nav aria-label="パンくずリスト" className="text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {all.map((item, i) => (
            <li key={item.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} aria-hidden="true" className="opacity-50" />}
              {i === all.length - 1 ? (
                <span aria-current="page" className="text-ink">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="transition-colors hover:text-brand">
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: all.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.label,
            item: absoluteUrl(item.href),
          })),
        }}
      />
    </>
  );
}
