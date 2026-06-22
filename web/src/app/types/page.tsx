import { AnalysisTabs } from "@/components/AnalysisTabs";
import { PageHeader, TableWrap, EmptyState, TH, TD, TH_NUM, TD_NUM } from "@/components/ui";
import { getTypeStats } from "@/lib/analytics";
import { formatNumber } from "@/lib/format";

function pct(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

export default async function TypesPage() {
  const types = await getTypeStats();

  if (types.length === 0) {
    return (
      <>
        <AnalysisTabs />
        <PageHeader title="产品类型分析" description="按类型/类型细化统计预计(工作日)与 P1/P10/P2/P20 指标。" />
        <EmptyState message="暂无数据，请先导入 Excel。" />
      </>
    );
  }

  return (
    <>
      <AnalysisTabs />
      <PageHeader
        title="产品类型分析"
        description="按类型/类型细化统计未完成/已完成预计(工作日)、P1 均值、P10 类型基准、P1/P10 偏离(P110)、P2/P20 偏离(P220)。"
      />

      <TableWrap>
        <thead>
          <tr>
            <th className={TH}>类型</th>
            <th className={TH}>类型细化</th>
            <th className={TH_NUM}>未完成条数</th>
            <th className={TH_NUM}>未完成预计(工作日)</th>
            <th className={TH_NUM}>已完成预计(工作日)</th>
            <th className={TH_NUM}>P1 均值</th>
            <th className={TH_NUM} title="同类型 P1 平均值，技术难度基准">
              P10
            </th>
            <th className={TH_NUM} title="P1 相对 P10 的平均偏离率">
              P110
            </th>
            <th className={TH_NUM} title="P2 相对 P20 的平均偏离率">
              P220
            </th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={`${t.type}-${t.typeDetail}`}>
              <td className={TD}>{t.type}</td>
              <td className={TD}>{t.typeDetail || "-"}</td>
              <td className={TD_NUM}>{t.incompleteCount}</td>
              <td className={TD_NUM}>{formatNumber(t.incompleteComplexity)}</td>
              <td className={TD_NUM}>{formatNumber(t.completeComplexity)}</td>
              <td className={TD_NUM}>{formatNumber(t.avgP1, 2)}</td>
              <td className={TD_NUM}>{formatNumber(t.p10, 2)}</td>
              <td className={TD_NUM}>{pct(t.p110)}</td>
              <td className={TD_NUM}>{pct(t.p220)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}
