import Link from "next/link";
import { PageHeader, TableWrap, EmptyState, TH, TD, TH_NUM, TD_NUM, DisplayDate, DisplayNumber, DisplayText } from "@/components/ui";
import { getQualityItems } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  const items = await getQualityItems();

  return (
    <>
      <PageHeader
        title="数据质量检查"
        description="列出关键字段异常，可跳转编辑修正。请从「项目明细」进入此页。"
        action={
          <Link href="/projects" className="rounded border border-slate-300 px-4 py-2 text-sm">
            返回明细
          </Link>
        }
      />

      {items.length === 0 ? (
        <EmptyState message="暂无数据质量问题，或请先导入 Excel。" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={TH}>问题</th>
              <th className={TH}>合同号</th>
              <th className={TH}>项目名称</th>
              <th className={TH}>型号</th>
              <th className={TH_NUM}>数量</th>
              <th className={TH}>发布日期</th>
              <th className={TH}>交期</th>
              <th className={TH}>负责人</th>
              <th className={TH_NUM}>预计(工作日)</th>
              <th className={TH}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className={`max-w-[160px] text-xs text-red-700 ${TD}`}>
                  {item.qualityIssues.join("、")}
                </td>
                <td className={TD}><DisplayText value={item.contractNo} /></td>
                <td className={`max-w-[180px] ${TD}`}>
                  <span className="line-clamp-2" title={item.projectName || undefined}>
                    <DisplayText value={item.projectName} />
                  </span>
                </td>
                <td className={TD}><DisplayText value={item.model} /></td>
                <td className={TD_NUM}><DisplayNumber value={item.quantity} digits={0} /></td>
                <td className={TD}><DisplayDate value={item.publishDate} /></td>
                <td className={TD}><DisplayDate value={item.dueDate} /></td>
                <td className={TD}><DisplayText value={item.owner} /></td>
                <td className={TD_NUM}><DisplayNumber value={item.estimatedComplexity} /></td>
                <td className={TD}>
                  <Link href={`/projects/${item.id}/edit`} className="text-sm text-blue-700">
                    去编辑
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
