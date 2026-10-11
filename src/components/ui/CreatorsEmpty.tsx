import { CTAButton } from "./CTAButton";

/** 掲載できる発信者がいないときの表示 */
export function CreatorsEmpty({ location }: { location: string }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-14 text-center text-white md:px-16 md:py-20">
      <div aria-hidden="true" className="absolute -top-24 -right-24 size-72 rounded-full bg-brand/30 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 -left-24 size-72 rounded-full bg-white/5 blur-3xl" />
      <div className="relative">
        <p className="num text-xs font-semibold tracking-[0.3em] text-white/50">CASTING PROPOSAL</p>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-[2] font-bold md:text-2xl">
          ご希望のジャンル・ご予算に合わせて、
          <br className="hidden md:block" />
          最適なグルメインフルエンサーをご提案します。
        </p>
        <p className="mt-4 text-sm text-white/70">まずはお気軽にお問い合わせください。</p>
        <div className="mt-10 flex justify-center">
          <CTAButton href="/contact" size="lg" trackLocation={location}>
            発信者の提案を依頼する
          </CTAButton>
        </div>
      </div>
    </div>
  );
}
