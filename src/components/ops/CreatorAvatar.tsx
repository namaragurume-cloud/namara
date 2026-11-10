/** 発信者のアイコン（未登録なら名前の頭文字） */
export function CreatorAvatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- 保存済みの小さな画像をそのまま表示する
    return <img src={src} alt="" width={size} height={size} style={style} className="shrink-0 rounded-full border border-[#e3e9f2] object-cover" />;
  }
  return (
    <span style={{ ...style, fontSize: size * 0.42 }} className="flex shrink-0 items-center justify-center rounded-full bg-[#eef3fb] font-bold text-[#1f5fbf]">
      {name.slice(0, 1)}
    </span>
  );
}
