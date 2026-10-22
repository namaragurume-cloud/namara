/**
 * シード固定の疑似乱数（mulberry32）。
 * サンプルデータを毎回同じ内容で生成するために使う。セキュリティ用途には使わないこと。
 */
export function createRng(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(list: readonly T[]): T {
      const item = list[Math.floor(next() * list.length)];
      if (item === undefined) throw new Error("pick: empty list");
      return item;
    },
  };
}
