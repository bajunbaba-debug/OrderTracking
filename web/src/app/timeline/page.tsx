import { Suspense } from "react";
import { TimelinePageClient } from "@/components/timeline/TimelinePageClient";
import { EmptyState } from "@/components/ui";
import { getServerTodayInShanghai } from "@/lib/server-date";

/** 每次请求动态计算 serverToday，避免 build/prerender 固定日期 */
export const dynamic = "force-dynamic";

export default function TimelinePage() {
  const serverToday = getServerTodayInShanghai();

  return (
    <Suspense fallback={<EmptyState message="加载订单时间流..." />}>
      <TimelinePageClient serverToday={serverToday} />
    </Suspense>
  );
}
