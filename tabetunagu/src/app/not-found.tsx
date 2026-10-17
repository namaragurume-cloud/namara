import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-[20px] font-bold">ページが見つかりませんでした</h1>
      <p className="mt-2 text-[13px] text-muted">URL が変わったか、受付が終わった可能性があります。</p>
      <ButtonLink href="/" className="mt-6">
        ホームへ
      </ButtonLink>
    </main>
  );
}
