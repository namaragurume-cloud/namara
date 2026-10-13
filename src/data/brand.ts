/**
 * KITACRE（キタクリ）のブランドコンセプト。
 * トップページの「KITACREとは」と、/about のブランド紹介で使用します。
 */

export const brand = {
  name: "KITACRE",
  kana: "キタクリ",
  slogan: "北の大地から、SNSで幸せを。",
  concept: "人と人がつながり、北海道に新しい価値と幸せを。",
  nameOrigin:
    "KITACRE（キタクリ）は、「北の大地」と「CREATOR・CREATIVE」を掛け合わせた、北海道発のクリエイターキャスティングサービスです。",
  symbol: [
    "シンボルマークは、人と人が手を取り合うように形成された「輪」をモチーフにしています。",
    "それぞれの個性や強みが一つの輪となり、発信を通じて新しい出会いと価値が生まれ、幸せが広がっていく未来を表現しています。",
  ],
  /** シンボルマークの4つの人物が象徴するもの */
  figures: [
    { en: "COMPANY", label: "企業", color: "red" },
    { en: "CREATOR", label: "クリエイター", color: "black" },
    { en: "CONSUMER", label: "消費者", color: "red" },
    { en: "KITACRE", label: "それらをつなぐKITACRE", color: "black" },
  ],
  values: [
    "私たちが大切にするのは、単に企業とクリエイターをマッチングすることではありません。",
    "関わるすべての人が互いの価値を高め合い、喜びを分かち合える関係を築くこと。",
  ],
  closing: "KITACREは、人と人とのつながりを大切にしながら、北海道の魅力をより多くの人へ届けていきます。",
} as const;
