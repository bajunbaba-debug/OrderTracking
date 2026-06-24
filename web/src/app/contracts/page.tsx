import { AnalysisTabs } from "@/components/AnalysisTabs";
import { ContractOwnerCount } from "@/components/ContractOwnersPanel";
import { PageHeader, TableWrap, EmptyState, TH, TD, TH_NUM, TD_NUM, DisplayDate, DisplayText } from "@/components/ui";
import { getContractStats } from "@/lib/analytics";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const contracts = await getContractStats();

  if (contracts.length === 0) {
    return (
      <>
        <AnalysisTabs />
        <PageHeader title="合同分析" description="按合同号聚合未完成项目。" />
        <EmptyState message="暂无数据，请先导入 Excel。" />
      </>
    );
  }

  return (
    <>
      <AnalysisTabs />
      <PageHeader
        title="合同分析"
        description="按合同号聚合：项目名称、未完成条数、总预计(工作日)、最早交期、负责人与类型数量。"
      />

      <TableWrap>
        <thead>
          <tr>
            <th className={TH}>合同号</th>
            <th className={TH}>项目名称</th>
            <th className={TH_NUM}>未完成条数</th>
            <th className={TH_NUM}>总预计(工作日)</th>
            <th className={TH}>最早交期</th>
            <th className={TH_NUM}>负责人数</th>
            <th className={TH_NUM}>类型数</th>
          </tr>
        </thead>
        <tbody>
          {contracts.map((c) => (
            <tr key={c.contractNo}>
              <td className={TD}><DisplayText value={c.contractNo} /></td>
              <td className={`max-w-[260px] ${TD}`}>
                <span className="line-clamp-2" title={c.projectName || undefined}>
                  <DisplayText value={c.projectName} />
                </span>
              </td>
              <td className={TD_NUM}>{c.incompleteCount}</td>
              <td className={TD_NUM}>{formatNumber(c.totalComplexity)}</td>
              <td className={TD}><DisplayDate value={c.earliestDue} /></td>
              <td className={TD_NUM}>
                <ContractOwnerCount count={c.ownerCount} owners={c.ownerDetails} />
              </td>
              <td className={TD_NUM}>{c.typeCount}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </>
  );
}
