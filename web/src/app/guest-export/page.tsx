import { GuestOrderSequenceExportClient } from "@/components/timeline/GuestOrderSequenceExportClient";
import { getServerTodayInShanghai } from "@/lib/server-date";

export const dynamic = "force-dynamic";

export default function GuestExportPage() {
  return <GuestOrderSequenceExportClient serverToday={getServerTodayInShanghai()} />;
}
