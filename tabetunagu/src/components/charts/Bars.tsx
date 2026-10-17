/** 依存ライブラリなしの簡易棒グラフ（値ラベル付き・アクセシブルな表も兼ねる） */
export function Bars({
  data,
  valueLabel,
  height = 140,
}: {
  data: { label: string; value: number }[];
  valueLabel?: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure>
      <div className="flex items-end gap-[3px]" style={{ height }} aria-hidden>
        {data.map((d) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
            <div
              className="rounded-t-[3px] bg-forest/80 transition-colors group-hover:bg-forest"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
              title={`${d.label}: ${valueLabel ? valueLabel(d.value) : d.value}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[9.5px] text-muted" aria-hidden>
        {data.map((d, i) => (
          <span key={d.label} className="tnum flex-1 truncate text-center">
            {data.length > 16 && i % 3 !== 0 ? "" : d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{valueLabel ? valueLabel(d.value) : d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
