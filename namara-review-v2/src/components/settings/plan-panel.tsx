"use client";

import { Check } from "lucide-react";

import { DemoNotice } from "@/components/common/demo-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PLANS } from "@/lib/constants";
import { useDemoState } from "@/lib/demo/store";
import { formatYen } from "@/lib/format";
import type { PlanId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlanPanel() {
  const organization = useDemoState((s) => s.organization);
  const storeCount = useDemoState((s) => s.stores.length);
  const plan = PLANS[organization.plan];

  return (
    <div className="space-y-4">
      <DemoNotice>料金は仮設定です。請求・決済機能は MVP 完成後に実装します。</DemoNotice>
      <Card>
        <CardHeader>
          <CardDescription>{organization.name}</CardDescription>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            現在のプラン：{plan.name}
            <Badge variant="success">契約中</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>利用店舗数</span>
            <span className="tabular">
              {storeCount} / {plan.stores}店舗
            </span>
          </div>
          <Progress value={(storeCount / plan.stores) * 100} />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const current = id === organization.plan;
          return (
            <Card key={id} className={cn(current && "border-brand ring-1 ring-brand")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {p.name}
                  {current ? <Badge variant="brand">現在のプラン</Badge> : null}
                </CardTitle>
                <p className="mt-1">
                  <span className="text-2xl font-bold text-primary">{formatYen(p.price)}</span>
                  <span className="text-sm text-muted-foreground"> / 月（税抜・仮）</span>
                </p>
                <CardDescription>最大{p.stores}店舗</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-1 size-3.5 shrink-0 text-success" aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
