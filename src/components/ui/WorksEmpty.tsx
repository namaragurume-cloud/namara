import { BarChart3, Eye, Heart, Link2 } from "lucide-react";

const metrics = [
  { icon: Eye, label: "再生数・リーチ数" },
  { icon: Heart, label: "いいね・保存数" },
  { icon: Link2, label: "投稿URL" },
  { icon: BarChart3, label: "案件ごとに合意した成果指標" },
];

/** 公開できる実績がまだないときの表示 */
export function WorksEmpty({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const dark = theme === "dark";
  return (
    <div
      className={
        dark
          ? "rounded-[28px] border border-white/10 bg-white/[0.03] p-8 md:p-14"
          : "rounded-[28px] border border-line bg-white p-8 md:p-14"
      }
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div>
          <p className={dark ? "text-lg font-bold text-white md:text-xl" : "text-lg font-bold md:text-xl"}>
            PR実績は、掲載許可と内容の確認が完了した事例から順次公開します。
          </p>
          <p className={dark ? "mt-4 text-sm leading-[2] text-white/60" : "mt-4 text-sm leading-[2] text-muted"}>
            ご依頼いただいたPRでは、確認できる範囲の指標を集計し、レポートとしてご報告します。売上や来店人数などは、クライアント様から実測データをご共有いただいた場合に扱います。
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 md:gap-4">
          {metrics.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className={
                dark
                  ? "flex flex-col gap-4 rounded-2xl bg-white/5 p-5 text-white"
                  : "flex flex-col gap-4 rounded-2xl bg-mist p-5"
              }
            >
              <Icon size={22} strokeWidth={1.6} className="text-brand" aria-hidden="true" />
              <span className="text-sm leading-relaxed font-bold">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
