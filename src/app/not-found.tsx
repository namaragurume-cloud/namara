import { CTAButton } from "@/components/ui/CTAButton";

export default function NotFound() {
  return (
    <section className="flex min-h-[80svh] items-center bg-mist pt-[var(--header-h)]">
      <div className="container-x text-center">
        <p className="num text-8xl font-extrabold text-brand md:text-9xl">404</p>
        <h1 className="mt-6 text-2xl font-bold">ページが見つかりませんでした</h1>
        <p className="mt-4 text-sm text-muted">お探しのページは移動または削除された可能性があります。</p>
        <div className="mt-10 flex justify-center">
          <CTAButton href="/" variant="dark">
            トップページへ
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
