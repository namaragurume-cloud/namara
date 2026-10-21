import type { Review, ReplyPolicy, Store, Tone, Topic } from "@/lib/types";

/**
 * 返信案ジェネレーター（Phase 1 はテンプレートによるモック）。
 *
 * Phase 4 で OpenAI API に置き換える。その際もこの関数のシグネチャと
 * checkReply() による安全チェックはそのまま使う。
 * - 口コミの具体的な内容（keyword）に言及する
 * - 評価で構成を変える（高評価=感謝中心 / 低評価=お詫び＋状況確認）
 * - 事実の追加・補償や改善の約束・投稿者名の使用をしない
 */

export interface GenerateReplyInput {
  review: Review;
  store: Pick<Store, "name" | "shortName">;
  policy: ReplyPolicy;
  tone: Tone;
  /** 再生成のたびに +1。言い回しを変える */
  variant?: number;
}

type Phrase = Record<Tone, string[]>;

const OPENING: Phrase = {
  polite: [
    "この度は{store}にご来店いただき、誠にありがとうございます。",
    "数ある飲食店の中から{store}をお選びいただき、誠にありがとうございます。",
  ],
  friendly: [
    "{store}にご来店いただき、ありがとうございます。",
    "先日は{store}をご利用いただき、ありがとうございました。",
  ],
  casual: ["ご来店ありがとうございました！", "{store}に来ていただき、ありがとうございます！"],
};

const OPENING_LOW: Phrase = {
  polite: ["この度は{store}にご来店いただき、誠にありがとうございます。"],
  friendly: ["{store}にご来店いただき、ありがとうございます。"],
  casual: ["ご来店いただき、ありがとうございます。"],
};

const RATING_ONLY: Phrase = {
  polite: ["高い評価をいただき、スタッフ一同大変励みになっております。"],
  friendly: ["評価をいただけて、スタッフ一同とてもうれしく思っています。"],
  casual: ["評価をいただけて、スタッフみんなで喜んでいます！"],
};

const POSITIVE: Record<Topic, Phrase> = {
  food: {
    polite: ["{kw}をお気に召していただけたとのこと、大変光栄に存じます。", "{kw}についてお褒めの言葉をいただき、厨房一同大変うれしく思っております。"],
    friendly: ["{kw}を気に入っていただけて、とてもうれしいです。", "{kw}をおいしいと言っていただけて、厨房スタッフも喜んでいます。"],
    casual: ["{kw}を気に入っていただけて、本当にうれしいです！", "{kw}をおいしいと言っていただけて、スタッフ一同大喜びです！"],
  },
  service: {
    polite: ["スタッフの対応についても温かいお言葉をいただき、ありがとうございます。"],
    friendly: ["スタッフの接客についてもお褒めいただき、ありがとうございます。本人たちにも伝えます。"],
    casual: ["スタッフへのうれしいお言葉もありがとうございます！みんなに伝えますね。"],
  },
  price: {
    polite: ["価格面でもご満足いただけたとのこと、大変うれしく存じます。"],
    friendly: ["お値段にもご満足いただけたようで、うれしいです。"],
    casual: ["お値段にも満足していただけて、うれしいです！"],
  },
  atmosphere: {
    polite: ["店内の雰囲気もお楽しみいただけたようで、何よりでございます。"],
    friendly: ["お店の雰囲気も楽しんでいただけたようで、何よりです。"],
    casual: ["お店の雰囲気も楽しんでいただけて、うれしいです！"],
  },
  speed: {
    polite: ["お料理の提供についてもお褒めいただき、ありがとうございます。"],
    friendly: ["お料理の提供スピードについてもお褒めいただき、ありがとうございます。"],
    casual: ["提供の早さにも触れていただき、ありがとうございます！"],
  },
  cleanliness: {
    polite: ["店内の清潔さにもお気づきいただき、ありがとうございます。"],
    friendly: ["店内の清潔さにも気づいていただけて、うれしいです。"],
    casual: ["お店のきれいさにも気づいていただけて、うれしいです！"],
  },
};

const NEGATIVE: Record<Topic, string> = {
  food: "お料理{kw}についてご期待に沿えず",
  service: "スタッフの対応でご不快な思いをおかけし",
  price: "価格についてご満足いただけず",
  atmosphere: "店内の環境でゆっくりお過ごしいただけず",
  speed: "お料理の提供までお待たせしてしまい",
  cleanliness: "店内の清潔さについてご不快な思いをおかけし",
};

const APOLOGY_END: Record<Tone, string> = {
  polite: "、誠に申し訳ございませんでした。",
  friendly: "、申し訳ございませんでした。",
  casual: "、申し訳ありませんでした。",
};

const ACKNOWLEDGE: Record<Tone, string> = {
  polite: "いただいたご意見は真摯に受け止め、スタッフ間で共有いたします。",
  friendly: "いただいたご意見はスタッフ全員で共有させていただきます。",
  casual: "いただいたご意見は、スタッフみんなで共有します。",
};

const CLOSING_HIGH: Phrase = {
  polite: ["またのご来店を心よりお待ち申し上げております。", "またお会いできる日をスタッフ一同心よりお待ちしております。"],
  friendly: ["またのご来店を心よりお待ちしております。", "またお気軽にお立ち寄りください。お待ちしております。"],
  casual: ["またぜひ遊びに来てくださいね！", "またのご来店、お待ちしています！"],
};

const CLOSING_MID: Phrase = {
  polite: ["次回はさらにご満足いただけるよう努めてまいります。またのご来店をお待ち申し上げております。"],
  friendly: ["またのご来店をお待ちしております。"],
  casual: ["また来ていただけたらうれしいです！"],
};

const CLOSING_LOW: Phrase = {
  polite: ["貴重なご意見をお寄せいただき、誠にありがとうございました。"],
  friendly: ["貴重なご意見をいただき、ありがとうございました。"],
  casual: ["貴重なご意見、ありがとうございました。"],
};

function pick(list: string[], variant: number, offset = 0) {
  return list[(variant + offset) % list.length];
}

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

export function generateReply({ review, store, policy, tone, variant = 0 }: GenerateReplyInput): string {
  const lines: string[] = [];
  const storeName = store.name;
  const isLow = review.rating <= 2;
  const positives = review.topics.filter((t) => t.sentiment === "positive");
  const negatives = review.topics.filter((t) => t.sentiment === "negative");

  lines.push(fill(pick((isLow ? OPENING_LOW : OPENING)[tone], variant), { store: storeName }));

  if (!review.text.trim()) {
    lines.push(pick(RATING_ONLY[tone], variant));
  }

  // 高評価・中評価は良かった点に先に触れる（最大2つ）
  const positiveLines = positives.slice(0, isLow ? 1 : 2).map((t, i) => {
    const kw = t.keyword ? `「${t.keyword}」` : "お料理";
    return fill(pick(POSITIVE[t.topic][tone], variant, i), { kw });
  });

  const negativeLines = negatives.slice(0, 2).map((t) => {
    const kw = t.topic === "food" && t.keyword ? `（${t.keyword}）` : "";
    return fill(NEGATIVE[t.topic], { kw });
  });

  if (isLow) {
    if (negativeLines.length > 0) {
      lines.push(negativeLines.join("、また") + APOLOGY_END[tone]);
    } else {
      lines.push(`ご期待に沿えない点があり${APOLOGY_END[tone]}`);
    }
    lines.push(...positiveLines);
    lines.push(ACKNOWLEDGE[tone]);
    if (policy.lowRatingGuidance.trim()) lines.push(policy.lowRatingGuidance.trim());
    lines.push(pick(CLOSING_LOW[tone], variant));
  } else {
    lines.push(...positiveLines);
    if (negativeLines.length > 0) {
      lines.push(negativeLines.join("、また") + APOLOGY_END[tone]);
      lines.push(ACKNOWLEDGE[tone]);
    }
    lines.push(pick((review.rating >= 4 ? CLOSING_HIGH : CLOSING_MID)[tone], variant));
  }

  if (policy.signature.trim()) lines.push(policy.signature.trim());

  return lines.join("\n");
}

export interface ReplyCheck {
  level: "error" | "warning";
  message: string;
}

/** 補償・断定的な改善の約束など、承認前に必ず人が確認すべき表現 */
const RISKY_PATTERNS: { pattern: RegExp; message: string }[] = [
  { pattern: /返金|全額|無料にいたし|無料で|割引いたし|クーポンを差し上げ/, message: "補償（返金・無料・割引）を約束する表現が含まれています" },
  { pattern: /必ず(改善|対応|解決)|二度と(ない|起こ)|徹底いたします/, message: "断定的な改善の約束が含まれています。実際に対応できる内容か確認してください" },
  { pattern: /[0-9０-９]{2,4}-[0-9０-９]{2,4}-[0-9０-９]{3,4}|@[a-z0-9.-]+\.[a-z]{2,}/i, message: "電話番号・メールアドレスが含まれています" },
];

/**
 * 返信文の安全チェック。UI では承認ボタンの横に表示し、
 * error がある間は承認できないようにする。
 */
export function checkReply(text: string, policy: ReplyPolicy, author?: string): ReplyCheck[] {
  const checks: ReplyCheck[] = [];
  const body = text.trim();
  if (!body) {
    checks.push({ level: "error", message: "返信文が空です" });
    return checks;
  }
  for (const word of policy.ngWords.map((w) => w.trim()).filter(Boolean)) {
    if (body.includes(word)) checks.push({ level: "error", message: `NGワード「${word}」が含まれています` });
  }
  if (body.length > 4096) {
    checks.push({ level: "error", message: "Googleの返信上限（4,096文字）を超えています" });
  } else if (body.length > policy.maxLength) {
    checks.push({ level: "warning", message: `目安の${policy.maxLength}文字を超えています（${body.length}文字）` });
  }
  for (const { pattern, message } of RISKY_PATTERNS) {
    if (pattern.test(body)) checks.push({ level: "warning", message });
  }
  if (author && author.length >= 2 && body.includes(author)) {
    checks.push({ level: "warning", message: "投稿者名が含まれています。必要な場合のみ使用してください" });
  }
  return checks;
}
