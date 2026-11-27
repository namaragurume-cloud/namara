"use client";

import { useEffect } from "react";

/** URLの #見出し が折りたたまれた欄の中にあるとき、その欄を開いてから移動する */
export function OpenHashTarget() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      let p: HTMLElement | null = el.parentElement;
      let changed = false;
      while (p) {
        if (p instanceof HTMLDetailsElement && !p.open) {
          p.open = true;
          changed = true;
        }
        p = p.parentElement;
      }
      if (changed) el.scrollIntoView();
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
