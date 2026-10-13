import { site } from "@/data/site";
import { pageMetadata } from "@/lib/metadata";
import { PageHero } from "@/components/ui/PageHero";

export const metadata = pageMetadata({
  title: "運営会社",
  description: `KITACRE（キタクリ）の運営会社、${site.company.name}の会社概要です。`,
  path: "/company",
});

export default function CompanyPage() {
  const c = site.company;
  const rows: [string, React.ReactNode][] = [
    ["会社名", c.name],
    ["代表者", `${c.representativeTitle}　${c.representative}`],
    ["所在地", `${c.postalCode ? `〒${c.postalCode} ` : ""}${c.address}`],
    ...(c.founded ? ([["設立", c.founded]] as [string, string][]) : []),
    ["運営メディア", c.media],
    [
      "Instagram",
      <a key="ig" href={site.instagram.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-brand">
        {site.instagram.handle}
        <span className="sr-only">（新しいタブで開きます）</span>
      </a>,
    ],
    [
      "事業内容",
      <ul key="biz" className="space-y-1">
        {c.business.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>,
    ],
  ];

  return (
    <>
      <PageHero en="COMPANY" title="運営会社" breadcrumb={[{ label: "運営会社", href: "/company" }]} />
      <section className="section">
        <div className="container-x max-w-4xl!">
          <dl className="border-t border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid gap-2 border-b border-line py-6 md:grid-cols-[200px_1fr] md:gap-8 md:py-8">
                <dt className="text-sm font-bold text-muted">{label}</dt>
                <dd className="text-[15px] leading-[1.9]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
