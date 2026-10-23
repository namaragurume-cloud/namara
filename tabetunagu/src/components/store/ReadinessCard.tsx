import { CircleCheck, CircleDashed } from "lucide-react";
import Link from "next/link";
import type { storeReadiness } from "@/lib/readiness";
import { Badge } from "../ui/Badge";

/** 導入準備チェック（PoC 公開可否の確認用） */
export function ReadinessCard({ readiness }: { readiness: ReturnType<typeof storeReadiness> }) {
  const ok = readiness.status === "公開準備OK";
  return (
    <section className="card p-5" data-testid="store-readiness">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">導入準備チェック</h2>
        <Badge tone={ok ? "green" : "sand"}>{readiness.status}</Badge>
      </div>
      <ul className="mt-3 space-y-1.5 text-[13px]">
        {readiness.items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            {item.ok ? (
              <CircleCheck className="h-4 w-4 shrink-0 text-forest" aria-label="完了" />
            ) : (
              <CircleDashed className="h-4 w-4 shrink-0 text-muted" aria-label="未完了" />
            )}
            {item.ok ? (
              <span>{item.label}</span>
            ) : (
              <Link href={item.href} className="font-semibold text-forest underline-offset-2 hover:underline">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted">
        使い方は <Link href="/store/help" className="underline">TABETUNAGU の使い方</Link> をご覧ください。
      </p>
    </section>
  );
}
