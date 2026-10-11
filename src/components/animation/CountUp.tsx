"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

type Props = { value: number; decimals?: number; duration?: number };

const format = (n: number, decimals: number) =>
  n.toLocaleString("ja-JP", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * 画面に入ったら数値をカウントアップ。
 * サーバー描画時は最終値を出力し（SEO・JS 無効時も正しい値）、幅は最終値で確保します（CLS 防止）。
 */
export function CountUp({ value, decimals = 0, duration = 1.8 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const reduce = useReducedMotion();
  const done = useRef(false);

  // 画面外にあるうちは 0 にしておく
  useEffect(() => {
    if (reduce || done.current || !textRef.current) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect && rect.top > window.innerHeight) textRef.current.textContent = format(0, decimals);
  }, [reduce, decimals]);

  useEffect(() => {
    if (!inView || reduce || done.current) return;
    done.current = true;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (textRef.current) textRef.current.textContent = format(v, decimals);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, decimals, duration]);

  const final = format(value, decimals);
  return (
    <span ref={ref} className="relative inline-grid tabular-nums">
      <span aria-hidden="true" className="invisible col-start-1 row-start-1">
        {final}
      </span>
      <span ref={textRef} className="col-start-1 row-start-1 text-right">
        {final}
      </span>
    </span>
  );
}
