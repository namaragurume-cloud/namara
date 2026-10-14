import type { LucideIcon } from "lucide-react";
import { BarChart3, CalendarCheck, Lightbulb, PartyPopper, Users } from "lucide-react";

export type Service = {
  id: string;
  no: string;
  en: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  items: string[];
  /** 補足（選定基準など） */
  extra?: { title: string; items: string[] };
  note?: string;
};

export const services: Service[] = [
  {
    id: "casting",
    no: "01",
    en: "CASTING",
    title: "インフルエンサーキャスティング",
    summary:
      "商材とターゲットを分析し、ジャンル・地域・フォロワー属性に合った発信者を選定。交渉からスケジュール調整まで担います。",
    icon: Users,
    items: ["商材とターゲットの分析", "発信者の選定", "スケジュール調整", "発信者との交渉", "起用人数の提案"],
    extra: {
      title: "選定基準",
      items: [
        "グルメジャンルとの親和性",
        "フォロワーの属性や地域",
        "過去の再生数・リーチ数",
        "店舗・商品の雰囲気との相性",
      ],
    },
  },
  {
    id: "direction",
    no: "02",
    en: "PLANNING & DIRECTION",
    title: "PR企画・ディレクション",
    summary:
      "PRの目的を整理し、投稿の構成から訴求ポイントの設計まで。見ているユーザーに魅力が伝わりやすい投稿に落とし込みます。",
    icon: Lightbulb,
    items: ["PR目的の整理", "SNS媒体の提案", "訴求ポイントの設計", "企画内容の調整", "発信者への企画共有"],
  },
  {
    id: "management",
    no: "03",
    en: "POST MANAGEMENT",
    title: "SNS投稿管理",
    summary:
      "投稿スケジュールの調整から内容の事前確認、PR表記のチェックまで。安心して任せられる進行管理を行います。",
    icon: CalendarCheck,
    items: [
      "投稿スケジュール調整",
      "投稿内容の事前確認（原則）",
      "正確な商品情報の確認",
      "PR表記の確認",
      "投稿完了の管理",
    ],
  },
  {
    id: "report",
    no: "04",
    en: "REPORTING",
    title: "効果測定・レポート",
    summary:
      "再生数・リーチ数・保存数など、確認できる範囲の指標を集計。次の施策につながるレポートをお届けします。",
    icon: BarChart3,
    items: ["再生数", "リーチ数", "いいね・保存など", "投稿URL", "その他、案件ごとに合意した成果指標"],
    note: "売上や来店人数などは、クライアント様から実測データをご共有いただいた場合に扱います。",
  },
  {
    id: "event",
    no: "05",
    en: "PR EVENT",
    title: "PRイベント企画",
    summary:
      "試食会や新商品発表、グルメインフルエンサーを招いた店舗イベントなど、リアルな体験を通じたPRを企画します。",
    icon: PartyPopper,
    items: ["試食会", "新商品PRイベント", "グルメインフルエンサーを招いた企画", "店舗のPRイベント"],
    note: "実施内容や規模は個別にお見積もりいたします。",
  },
];

export type Platform = { name: string; format: string; description: string };

export const platforms: Platform[] = [
  {
    name: "Instagram",
    format: "リール",
    description: "縦型の短尺動画で、料理の湯気やシズル感、店内の雰囲気まで臨場感をもって伝えられます。",
  },
  {
    name: "Instagram",
    format: "フィード",
    description: "写真と文章でメニューや店舗情報を丁寧に紹介。保存されやすく、来店前の比較検討にも役立ちます。",
  },
  {
    name: "Instagram",
    format: "ストーリーズ",
    description: "24時間で消える気軽な投稿。キャンペーン告知やリンクを使った誘導など、即時性のあるPRに。",
  },
  {
    name: "TikTok",
    format: "ショート動画",
    description: "おすすめフィードを通じて、フォロワー以外のユーザーにも情報が届く可能性があります。",
  },
];
