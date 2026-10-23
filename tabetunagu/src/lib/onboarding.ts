/**
 * 店舗の「TABETUNAGU を始める準備」（オンボーディング）。進捗は専用の完了フラグを持たず、
 * 店舗情報・売上受取設定・商品・公開・受取モニターの実際の状態（lib/readiness と同じ判定）から毎回計算する。
 * 途中でブラウザを閉じても、次に開いたときに現在の状態から再開できる。
 */

export type OnboardingInput = {
  storeActive: boolean;
  /** 未入力の店舗情報（住所・電話番号・営業時間） */
  missingInfo: ("住所" | "電話番号" | "営業時間")[];
  /** 受取時の案内（受取場所）。空または以前の方式の文言なら入力を勧める（必須ではない） */
  pickupNote: string;
  /** 売上受取設定: 未開始 / 途中（追加情報の入力が必要）/ 完了 */
  payout: "not_started" | "in_progress" | "done";
  productCount: number;
  publishedCount: number;
  monitorOpened: boolean;
  isOwner: boolean;
};

export type OnboardingStepKey = "info" | "payout" | "product" | "publish" | "monitor";

export type OnboardingStep = {
  key: OnboardingStepKey;
  no: number;
  title: string;
  done: boolean;
  /** 現在の状態の説明（技術用語・内部の値は使わない） */
  status: string;
  /** 次にやること（未完了のときは必ず1つ。スタッフが操作できない項目は null） */
  cta: { label: string; href: string } | null;
};

/** 受取場所の案内が未入力、または以前の方式（予約・QR・店頭のお会計）の文言のまま */
export function pickupNoteNeedsUpdate(note: string) {
  return !note.trim() || /予約|QR|ＱＲ|お会計|チェックイン/i.test(note);
}

export function onboardingSteps(i: OnboardingInput): OnboardingStep[] {
  const infoDone = i.storeActive && i.missingInfo.length === 0;
  const payoutDone = i.payout === "done";
  const productDone = i.productCount > 0;
  const publishDone = infoDone && payoutDone && productDone && i.publishedCount > 0;
  const pickupNoteMissing = pickupNoteNeedsUpdate(i.pickupNote);

  const info: OnboardingStep = {
    key: "info",
    no: 1,
    title: "店舗情報を確認",
    done: infoDone,
    status: !i.storeActive
      ? "店舗は運営の確認待ちです。確認が終わると公開できます。"
      : i.missingInfo.length > 0
        ? `${i.missingInfo.join("・")}を入力してください。`
        : pickupNoteMissing
          ? "完了しています。受取場所の案内（例：入口すぐのカウンターでお渡しします）を入れると、お客様が迷いません。"
          : "完了しています。",
    cta:
      i.isOwner && (i.missingInfo.length > 0 || pickupNoteMissing)
        ? { label: i.missingInfo.length > 0 ? "店舗情報を入力する" : "受取場所の案内を入れる", href: "/store/settings#store-info" }
        : null,
  };
  const payout: OnboardingStep = {
    key: "payout",
    no: 2,
    title: "売上受取設定",
    done: payoutDone,
    status: payoutDone
      ? "売上受取設定 完了"
      : i.payout === "in_progress"
        ? "あと少しで完了です。追加情報の入力が必要です。"
        : i.isOwner
          ? "売上を受け取るための設定です。"
          : "売上を受け取るための設定です。店舗オーナーが設定します。",
    cta: payoutDone || !i.isOwner ? null : { label: i.payout === "in_progress" ? "売上受取設定を続ける" : "売上受取設定を始める", href: "/store/payouts" },
  };
  const product: OnboardingStep = {
    key: "product",
    no: 3,
    title: "最初の商品を登録",
    done: productDone,
    status: productDone
      ? i.publishedCount > 0
        ? "商品登録 完了"
        : "商品は登録されています。公開設定をご確認ください。"
      : "最初の商品を出品してみましょう。",
    cta: productDone ? null : { label: "商品を登録する", href: "/store/products/new?first=1" },
  };
  const reasons = publishReasons(i, { infoDone, payoutDone, productDone });
  const publish: OnboardingStep = {
    key: "publish",
    no: 4,
    title: "公開準備を確認",
    done: publishDone,
    status: publishDone ? "準備ができました。商品を公開できます。" : reasons.join(" / "),
    cta: publishDone ? null : firstReasonCta(i, { infoDone, payoutDone, productDone }),
  };
  const monitor: OnboardingStep = {
    key: "monitor",
    no: 5,
    title: "店舗モニターを体験",
    done: i.monitorOpened,
    status: i.monitorOpened ? "受取モニターを確認済みです。" : "お客様が来店したときの受取の流れを確認しましょう。",
    cta: i.monitorOpened ? null : { label: "受取の流れを確認する", href: "/store/monitor" },
  };
  return [info, payout, product, publish, monitor];
}

/** 公開できない理由（1画面で何が足りないか分かるように、具体的に） */
export function publishReasons(
  i: OnboardingInput,
  s: { infoDone: boolean; payoutDone: boolean; productDone: boolean },
): string[] {
  const reasons: string[] = [];
  if (!i.storeActive) reasons.push("店舗の確認が終わるまでお待ちください");
  for (const f of i.missingInfo) reasons.push(`店舗情報の${f}を入力してください`);
  if (!s.payoutDone) reasons.push("売上受取設定を完了してください");
  if (!s.productDone) reasons.push("商品を登録してください");
  else if (i.publishedCount === 0) reasons.push("公開できる商品がありません");
  return reasons;
}

function firstReasonCta(i: OnboardingInput, s: { infoDone: boolean; payoutDone: boolean; productDone: boolean }) {
  if (i.missingInfo.length > 0 && i.isOwner) return { label: "店舗情報を入力する", href: "/store/settings#store-info" };
  if (!s.payoutDone && i.isOwner) return { label: "売上受取設定を始める", href: "/store/payouts" };
  if (!s.productDone || i.publishedCount === 0) return { label: "商品を出品する", href: "/store/products/new" };
  return null;
}

export function onboardingProgress(steps: OnboardingStep[]) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? null;
  return { done, total: steps.length, complete: done === steps.length, next, label: `${done} / ${steps.length} 完了` };
}

/** 受取の流れ（お客様の受取チケット・店舗モニターの実装と同じ順番） */
export const PICKUP_FLOW = [
  { title: "お客様が来店", body: "受取時間内にお客様がお店に来られます。お支払いはオンラインで完了しています。" },
  { title: "受取チケットを確認", body: "お客様のスマホの受取チケット（支払い済み・注文番号・商品）を確認します。" },
  { title: "商品をお渡しする", body: "チケットの商品をお渡しします。レジ操作・店頭でのお会計はありません。" },
  { title: "お客様がスワイプ", body: "商品を受け取ったお客様が、ご自身の画面でスワイプして受取完了にします。" },
  { title: "モニターに「受取完了」", body: "店舗モニターに受取完了が表示され、通知音が鳴ります。店舗側の完了操作は不要です。" },
] as const;
