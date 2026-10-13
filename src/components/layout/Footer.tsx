import Link from "next/link";
import { brand } from "@/data/brand";
import { footerNav, mainNav, site } from "@/data/site";
import { CTAButton } from "@/components/ui/CTAButton";
import { InstagramIcon } from "@/components/ui/InstagramIcon";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  const sub = footerNav.filter((n) => !mainNav.includes(n));
  return (
    <footer className="bg-ink text-white">
      <div className="container-x py-20 md:py-24">
        <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label={`${site.brand} トップページ`} className="inline-block">
              <Logo light />
            </Link>
            <p className="mt-6 text-lg font-bold">{brand.slogan}</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
              北海道発のクリエイターキャスティングサービス。企画から発信者の選定、投稿管理、効果報告までワンストップで対応します。
            </p>
            <a
              href={site.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition-colors hover:text-white"
            >
              <InstagramIcon size={18} />
              {site.instagram.handle}
              <span className="text-xs font-normal text-white/50">（運営メディア なまらグルメ）</span>
              <span className="sr-only">（新しいタブで開きます）</span>
            </a>
          </div>

          <nav aria-label="フッターメニュー" className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm lg:col-span-2">
            <ul className="space-y-3">
              {mainNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-white/70 transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <ul className="space-y-3">
              {sub.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-white/70 transition-colors hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-16 flex flex-col gap-6 rounded-2xl border border-white/10 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <p className="font-bold">北海道のグルメPR、まずはご相談ください。</p>
            <p className="mt-1 text-sm text-white/60">ご予算5万円からご相談いただけます。</p>
          </div>
          <CTAButton href="/contact" trackLocation="footer">
            無料相談・お見積もり
          </CTAButton>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-8 text-xs text-white/50 md:flex-row md:items-end md:justify-between">
          <address className="not-italic leading-relaxed">
            {site.brand}（{site.brandKana}）運営：{site.company.name}／{site.media}
            <br />
            {site.company.address}
          </address>
          <p className="num tracking-wider">
            © {new Date().getFullYear()} {site.company.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
