import { Fragment } from "react";
import Link from "next/link";
import { AnalysisTabs } from "@/components/AnalysisTabs";
import { PageHeader, TableWrap, EmptyState, TH, TD, TH_NUM, TD_NUM } from "@/components/ui";
import { getMemberStats } from "@/lib/analytics";
import { formatNumber } from "@/lib/format";

function pct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams?: Promise<{ load?: string }>;
}) {
  const params = await searchParams;
  const mode = params?.load === "all" ? "all" : "incomplete";
  const members = await getMemberStats(mode);
  const isAll = mode === "all";
  const countLabel = isAll ? "总条数" : "未完成条数";
  const complexityLabel = isAll ? "总预计(工作日)" : "未完成预计(工作日)";

  if (members.length === 0) {
    return (
      <>
        <AnalysisTabs />
        <PageHeader title="成员分析" description="按负责人汇总未完成负载与交期区间拆分。" />
        <EmptyState message="暂无数据，请先导入 Excel。" />
      </>
    );
  }

  return (
    <>
      <AnalysisTabs />
      <PageHeader
        title="成员分析"
        description="按负责人和类型展示未完成负载，以及个人在该类型下的 P1/P10/P110/P220。"
        action={
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1 text-sm">
            <Link
              href="/members"
              className={`rounded-md px-3 py-1.5 ${
                !isAll ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              未完成负载
            </Link>
            <Link
              href="/members?load=all"
              className={`rounded-md px-3 py-1.5 ${
                isAll ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              总负载
            </Link>
          </div>
        }
      />

      <TableWrap>
        <thead>
          <tr>
            <th className={TH}>负责人</th>
            <th className={TH}>类型</th>
            <th className={TH_NUM}>{countLabel}</th>
            <th className={TH_NUM}>{complexityLabel}</th>
            {isAll ? <th className={TH_NUM}>已完成条数</th> : null}
            <th className={TH_NUM}>P1 均值</th>
            <th className={TH_NUM}>P10</th>
            <th className={TH_NUM}>P110</th>
            <th className={TH_NUM}>P220</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <Fragment key={m.owner}>
              {m.typeRows.map((row, index) => (
                <tr key={`${m.owner}-${row.type}`}>
                  {index === 0 ? (
                    <td className={`font-medium ${TD}`} rowSpan={m.typeRows.length}>
                      <div>{m.owner}</div>
                      <div className="mt-1 text-xs font-normal text-slate-500">
                        共 {m.count} 条 / {formatNumber(m.complexity)} 工作日
                      </div>
                    </td>
                  ) : null}
                  <td className={TD}>{row.type}</td>
                  <td className={TD_NUM}>{row.count}</td>
                  <td className={TD_NUM}>{formatNumber(row.complexity)}</td>
                  {isAll ? <td className={TD_NUM}>{row.completeCount}</td> : null}
                  <td className={TD_NUM}>{formatNumber(row.avgP1, 2)}</td>
                  <td className={TD_NUM}>{formatNumber(row.p10, 2)}</td>
                  <td className={TD_NUM}>{pct(row.p110)}</td>
                  <td className={TD_NUM}>{pct(row.p220)}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}
