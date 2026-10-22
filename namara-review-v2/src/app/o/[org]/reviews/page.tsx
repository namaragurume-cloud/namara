import type { Metadata } from "next";
import { Suspense } from "react";

import { ReviewsView } from "@/components/reviews/reviews-view";
import Loading from "../loading";

export const metadata: Metadata = { title: "口コミ管理" };

export default function ReviewsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReviewsView />
    </Suspense>
  );
}
