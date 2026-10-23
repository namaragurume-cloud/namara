// staff-dashboard/src/lib/chime.ts と同じ（本体アプリの店舗モニター用に移植）
/**
 * 完了音「チリン♪」。音源ファイルを使わず Web Audio API で合成する（ベルのような減衰音）。
 * ブラウザの制約で、最初に1回ユーザーが画面に触れる（unlockAudio）まで音は鳴らない。
 */
let ctx: AudioContext | null = null;

export function unlockAudio() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return false;
  ctx ??= new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return true;
}

export function audioReady() {
  return ctx !== null && ctx.state === "running";
}

export function playChime() {
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.01;
  const strike = (freq: number, at: number, gain: number, decay: number) => {
    for (const [mult, level] of [
      [1, 1],
      [2.76, 0.28],
      [5.4, 0.1],
    ] as const) {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(gain * level, t0 + at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + decay);
      osc.connect(g).connect(ctx!.destination);
      osc.start(t0 + at);
      osc.stop(t0 + at + decay + 0.05);
    }
  };
  strike(1318.5, 0, 0.32, 1.1); // E6
  strike(1975.5, 0.11, 0.26, 1.4); // B6
}
