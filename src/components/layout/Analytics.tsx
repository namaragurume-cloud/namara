import Script from "next/script";

/**
 * Google Analytics 4。NEXT_PUBLIC_GA_ID が設定されている場合のみ読み込みます。
 * Cookie 同意バナーを導入する場合は、同意後にこのコンポーネントを描画するよう変更してください。
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${id}');`}
      </Script>
    </>
  );
}
