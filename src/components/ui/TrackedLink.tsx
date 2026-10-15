"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { track } from "@/lib/analytics";

type Props = ComponentProps<typeof Link> & { event: string; params?: Record<string, string> };

/** クリック時に計測イベントを送信するリンク */
export function TrackedLink({ event, params, onClick, ...props }: Props) {
  return (
    <Link
      {...props}
      onClick={(e) => {
        track(event, params);
        onClick?.(e);
      }}
    />
  );
}
