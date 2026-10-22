import { Suspense } from "react";

import { OrgGate, ShellSkeleton } from "@/components/layout/org-gate";

/**
 * 法人専用ページ（/o/{法人ID}/...）。法人ごとにURLとデータが分かれる。
 * params はリクエスト時に決まる値なので Suspense の中で読む（Cache Components の作法）。
 */
export default function OrganizationLayout({ children, params }: LayoutProps<"/o/[org]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      {params.then(({ org }) => (
        <OrgGate slug={org}>{children}</OrgGate>
      ))}
    </Suspense>
  );
}
