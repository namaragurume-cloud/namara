import type { Metadata } from "next";
import { Suspense } from "react";

import { RepliesView } from "@/components/replies/replies-view";
import Loading from "../loading";

export const metadata: Metadata = { title: "AI返信管理" };

export default function RepliesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <RepliesView />
    </Suspense>
  );
}
