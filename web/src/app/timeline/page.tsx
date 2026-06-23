import { Suspense } from "react";
import { TimelinePageClient } from "@/components/timeline/TimelinePageClient";
import { EmptyState } from "@/components/ui";

export default function TimelinePage() {
  return (
    <Suspense fallback={<EmptyState message="加载订单时间流..." />}>
      <TimelinePageClient />
    </Suspense>
  );
}
