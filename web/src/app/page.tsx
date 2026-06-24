import Link from "next/link";
import { DashboardWorkloadPanel } from "@/components/DashboardWorkloadPanel";
import { StatCard, PageHeader, EmptyState } from "@/components/ui";
import { getDashboardStats } from "@/lib/analytics";
import { APP_CONFIG } from "@/lib/config";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  if (stats.totalCount === 0) {
    return (
      <>
        <PageHeader
          title="总览看板"
          description={`统计基准日期：${APP_CONFIG.statsDate}`}
          action={
            <Link
              href="/import?from=projects"
              className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
            >
              去导入 Excel
            </Link>
          }
        />
        <EmptyState message="暂无数据，请先从 Excel 导入项目明细。" />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="总览看板"
        description={`统计基准日期：${APP_CONFIG.statsDate} · 共 ${stats.totalCount} 条明细`}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard
          title="未完成总预计(工作日)"
          value={formatNumber(stats.incompleteComplexity)}
          sub={`${stats.incompleteCount} 条未完成`}
        />
        <StatCard title="未完成条数" value={stats.incompleteCount} />
        <StatCard
          title="7天内到期"
          value={formatNumber(stats.dueIn7Complexity)}
          sub={`${stats.dueIn7Count} 条`}
          href="/projects?status=unfinished&dueBucket=7d"
        />
        <StatCard
          title="8-14天到期"
          value={formatNumber(stats.dueIn814Complexity)}
          sub={`${stats.dueIn814Count} 条`}
          href="/projects?status=unfinished&dueBucket=8_14d"
        />
        <StatCard
          title="交期缺失"
          value={stats.missingDueCount}
          sub={`预计(工作日) ${formatNumber(stats.missingDueComplexity)}`}
        />
        <StatCard
          title="数据质量问题"
          value={stats.qualityIssueCount}
          href={stats.qualityIssueCount > 0 ? "/quality?from=projects" : undefined}
          disabled={stats.qualityIssueCount <= 0}
        />
        <StatCard title="已完成" value={stats.completeCount} />
      </div>

      <DashboardWorkloadPanel
        chart={stats.memberTypeChart}
        ownerRanking={stats.ownerRanking}
        completedOwnerRanking={stats.completedOwnerRanking}
        typeRanking={stats.typeRanking}
      />
    </>
  );
}
