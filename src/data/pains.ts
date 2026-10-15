import type { LucideIcon } from "lucide-react";
import { Clock, Megaphone, Smartphone, Store, UserSearch, Wallet } from "lucide-react";

/** トップページ「こんなお悩みはありませんか？」 */
export const pains: { icon: LucideIcon; text: string }[] = [
  { icon: Store, text: "新店舗をオープンしたが認知が広がらない" },
  { icon: Smartphone, text: "Instagramで集客したいが方法がわからない" },
  { icon: UserSearch, text: "どのインフルエンサーに依頼すべきかわからない" },
  { icon: Megaphone, text: "新商品や新メニューを広めたい" },
  { icon: Clock, text: "SNS運用に時間をかけられない" },
  { icon: Wallet, text: "限られた予算で効果的なPRをしたい" },
];
