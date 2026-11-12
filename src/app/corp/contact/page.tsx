import type { Metadata } from "next";
import { isMailConfigured } from "@/lib/mail";
import { CorpContactForm } from "@/components/forms/CorpContactForm";
import { SectionLabel } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: "株式会社North Pleasureへのお問い合わせはこちらから。",
  alternates: { canonical: "/corp/contact" },
};

export default function CorpContactPage() {
  const configured = isMailConfigured("corp");
  return (
    <section className="section">
      <div className="container-x max-w-3xl!">
        <SectionLabel>CONTACT</SectionLabel>
        <h1 className="heading-lg mt-5">お問い合わせ</h1>
        <p className="lead mt-6 text-ink/75">
          事業へのご相談、取材のご依頼など、お気軽にお問い合わせください。内容を確認のうえ、担当者よりご連絡いたします。
        </p>
        <div className="mt-12">
          <CorpContactForm configured={configured} />
        </div>
      </div>
    </section>
  );
}
